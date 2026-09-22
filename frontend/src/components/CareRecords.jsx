import { useEffect, useMemo, useRef, useState } from 'react';
import { symptomCategories } from '../data/symptoms';
import { fetchCareRecords, createCareRecord, closeCareRecord } from '../api/careRecords';

const URGENT_SYMPTOM_ID = 'breathing';
const URGENT_SEVERITY = 4;

const severityStyles = {
  1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  2: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  3: 'bg-amber-100 text-amber-700 border-amber-200',
  4: 'bg-red-100 text-red-700 border-red-200',
  5: 'bg-red-100 text-red-700 border-red-200',
};

const pad = (value) => String(value).padStart(2, '0');

const toLocalInputValue = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatDateTime = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isUrgent = (record) =>
  record.severity >= URGENT_SEVERITY || record.symptomId === URGENT_SYMPTOM_ID;

const CareRecords = ({ initialSymptomId, onBack, onUrgentChange }) => {
  const [records, setRecords] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [symptomId, setSymptomId] = useState(initialSymptomId || symptomCategories[0].id);
  const [severity, setSeverity] = useState(3);
  const [occurredAt, setOccurredAt] = useState(() => toLocalInputValue(new Date()));
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 每次"新提交"在开始时生成一个幂等键；网络失败重试沿用同一键，
  // 保证同一提交即使重复到达也只生成一条记录
  const idempotencyKeyRef = useRef('');

  const [closingId, setClosingId] = useState(null);
  const [closeNote, setCloseNote] = useState('');
  const [closeError, setCloseError] = useState('');
  const [savingClose, setSavingClose] = useState(false);

  const load = async () => {
    const data = await fetchCareRecords();
    setRecords(data);
    setLoadError('');
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await fetchCareRecords();
        if (active) {
          setRecords(data);
          setLoadError('');
        }
      } catch (error) {
        if (active) setLoadError(error.message);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const hasUrgent = useMemo(() => Array.isArray(records) && records.some(isUrgent), [records]);

  useEffect(() => {
    onUrgentChange?.(hasUrgent);
    // 离开照护记录视图时收起固定提醒，避免状态残留
    return () => onUrgentChange?.(false);
  }, [hasUrgent, onUrgentChange]);

  const sortedRecords = useMemo(
    () => (records || [])
      .slice()
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [records],
  );

  const openCount = useMemo(
    () => (records || []).filter((record) => record.status !== 'closed').length,
    [records],
  );

  const ensureIdempotencyKey = () => {
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = (crypto.randomUUID?.() || `key-${Date.now()}-${Math.random()}`);
    }
    return idempotencyKeyRef.current;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setFormError('');

    const symptom = symptomCategories.find((item) => item.id === symptomId);
    if (!symptom) {
      setFormError('请从已有症状中选择一项');
      return;
    }
    if (!occurredAt) {
      setFormError('请选择发生时间');
      return;
    }
    const occurredMs = Date.parse(occurredAt);
    if (!Number.isFinite(occurredMs) || occurredMs > Date.now() + 60 * 1000) {
      setFormError('发生时间不合法');
      return;
    }
    if (!note.trim()) {
      setFormError('请填写观察说明');
      return;
    }

    setSubmitting(true);
    try {
      const key = ensureIdempotencyKey();
      const { record } = await createCareRecord(
        {
          symptomId,
          severity: Number(severity),
          occurredAt: new Date(occurredAt).toISOString(),
          note: note.trim(),
        },
        key,
      );

      // 只有服务端确认保存成功后才更新列表与计数
      setRecords((prev) => {
        const base = prev || [];
        if (base.some((item) => item.id === record.id)) return prev;
        return [record, ...base];
      });

      // 成功后重置表单并废弃旧幂等键，下一条是全新提交
      idempotencyKeyRef.current = '';
      setNote('');
      setSeverity(3);
      setOccurredAt(toLocalInputValue(new Date()));
    } catch (error) {
      // 保存失败：不动现有列表和计数，保留表单内容便于重试
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startClose = (record) => {
    setClosingId(record.id);
    setCloseNote('');
    setCloseError('');
  };

  const cancelClose = () => {
    setClosingId(null);
    setCloseNote('');
    setCloseError('');
  };

  const handleClose = async (record) => {
    if (savingClose) return;
    setCloseError('');
    if (!closeNote.trim()) {
      setCloseError('请填写结案说明，未填写说明不得结案');
      return;
    }

    setSavingClose(true);
    try {
      const { record: updated } = await closeCareRecord(record.id, closeNote.trim());
      // 结案成功：用服务端返回的状态替换该条，原始记录内容保留
      setRecords((prev) => (prev || []).map((item) => (item.id === updated.id ? updated : item)));
      cancelClose();
    } catch (error) {
      setCloseError(error.message);
    } finally {
      setSavingClose(false);
    }
  };

  const selectedUrgent = Number(severity) >= URGENT_SEVERITY || symptomId === URGENT_SYMPTOM_ID;

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sky-600 hover:text-sky-700 mb-6 transition-colors font-medium"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
        返回症状列表
      </button>

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 mb-8 border border-white/60">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📋</span>
          <h3 className="text-2xl font-bold text-warm-800">照护记录</h3>
        </div>
        <p className="text-warm-500 leading-relaxed mb-6">
          从已有症状中选择并记录每次观察。记录会持续保存，刷新或重启服务后仍然可见，便于连续照护与交接。
        </p>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-2">
              症状 <span className="text-red-500">*</span>
            </label>
            <select
              value={symptomId}
              onChange={(event) => setSymptomId(event.target.value)}
              className="w-full rounded-xl border border-warm-200 bg-white px-4 py-3 text-warm-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
            >
              {symptomCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.icon} {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-2">
                严重度（1–5 分） <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSeverity(value)}
                    className={`flex-1 py-3 rounded-xl border-2 font-bold text-lg transition-all ${
                      severity === value
                        ? severityStyles[value]
                        : 'bg-white border-warm-200 text-warm-400 hover:border-sky-300'
                    }`}
                    aria-pressed={severity === value}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="text-xs text-warm-400 mt-1.5">1 分轻微，5 分难以忍受；达到 4 分将触发紧急就医提醒</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-warm-700 mb-2">
                发生时间 <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={occurredAt}
                max={toLocalInputValue(new Date())}
                onChange={(event) => setOccurredAt(event.target.value)}
                className="w-full rounded-xl border border-warm-200 bg-white px-4 py-3 text-warm-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-2">
              观察说明 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="例如：餐后约半小时出现恶心，未呕吐；已抬高床头、暂停油腻食物……"
              className="w-full rounded-xl border border-warm-200 bg-white px-4 py-3 text-warm-800 resize-y focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
            />
          </div>

          {selectedUrgent && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <span className="text-xl flex-shrink-0">🚨</span>
              <p className="text-sm text-red-700 leading-relaxed">
                当前症状为呼吸困难或严重度达到 4 分以上，保存后页面将固定显示紧急就医提醒，请立即联系医护人员或前往急诊。
              </p>
            </div>
          )}

          {formError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <span>⚠️</span>
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold shadow-lg shadow-sky-200 hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? '保存中…' : '保存照护记录'}
            </button>
            <p className="text-xs text-warm-400">保存失败不会影响已有记录，可稍后重试</p>
          </div>
        </form>
      </div>

      <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 border border-white/60">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="text-xl font-bold text-warm-800">历史照护记录</h3>
          {records && (
            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-1.5 rounded-full bg-sky-100 text-sky-700 font-medium">
                共 {records.length} 条
              </span>
              <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                待结案 {openCount} 条
              </span>
            </div>
          )}
        </div>

        {loadError && (
          <div className="text-center py-10">
            <p className="text-red-600 mb-4">⚠️ {loadError}</p>
            <button
              onClick={load}
              className="px-5 py-2.5 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-600 transition-colors"
            >
              重新加载
            </button>
          </div>
        )}

        {!loadError && records === null && (
          <p className="text-center text-warm-400 py-10">正在加载记录…</p>
        )}

        {!loadError && records !== null && sortedRecords.length === 0 && (
          <p className="text-center text-warm-400 py-10">暂无照护记录，填写上方表单开始第一次记录。</p>
        )}

        <ul className="space-y-4">
          {sortedRecords.map((record) => {
            const urgent = isUrgent(record);
            const closed = record.status === 'closed';
            const symptom = symptomCategories.find((item) => item.id === record.symptomId);
            return (
              <li
                key={record.id}
                className={`rounded-2xl border p-5 ${
                  urgent ? 'border-red-200 bg-red-50/60' : 'border-warm-200 bg-warm-50/60'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-lg font-bold text-warm-800">
                      {symptom?.icon || '📝'} {record.symptomTitle}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${severityStyles[record.severity]}`}>
                      严重度 {record.severity}
                    </span>
                    {urgent && (
                      <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-bold">
                        🚨 紧急
                      </span>
                    )}
                    {closed && (
                      <span className="px-2.5 py-1 rounded-lg bg-warm-200 text-warm-700 text-xs font-bold">
                        已结案
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-warm-500">发生于 {formatDateTime(record.occurredAt)}</span>
                </div>

                <p className="mt-3 text-warm-700 leading-relaxed whitespace-pre-wrap">{record.note}</p>

                <div className="mt-3 text-xs text-warm-400">
                  记录时间 {formatDateTime(record.createdAt)}
                </div>

                {closed && (
                  <div className="mt-3 rounded-xl bg-white/70 border border-warm-200 px-4 py-3">
                    <p className="text-xs font-semibold text-warm-500 mb-1">结案说明（原始观察记录仍完整保留）</p>
                    <p className="text-sm text-warm-700 whitespace-pre-wrap">{record.closeNote}</p>
                    <p className="mt-1.5 text-xs text-warm-400">结案时间 {formatDateTime(record.closedAt)}</p>
                  </div>
                )}

                {!closed && closingId !== record.id && (
                  <button
                    type="button"
                    onClick={() => startClose(record)}
                    className="mt-3 px-4 py-2 rounded-lg border border-warm-300 text-sm font-medium text-warm-600 hover:bg-white hover:border-sky-300 hover:text-sky-600 transition-colors"
                  >
                    结案
                  </button>
                )}

                {!closed && closingId === record.id && (
                  <div className="mt-3 space-y-3">
                    <label className="block text-sm font-semibold text-warm-700">
                      结案说明 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={closeNote}
                      onChange={(event) => setCloseNote(event.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="说明转归与处置，例如：用药后疼痛降至 1 分，家属已了解注意事项……"
                      className="w-full rounded-xl border border-warm-200 bg-white px-4 py-2.5 text-sm text-warm-800 resize-y focus:outline-none focus:ring-2 focus:ring-sky-400"
                    />
                    {closeError && <p className="text-sm text-red-600">⚠️ {closeError}</p>}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleClose(record)}
                        disabled={savingClose}
                        className="px-4 py-2 rounded-lg bg-warm-700 text-white text-sm font-medium hover:bg-warm-800 transition-colors disabled:opacity-60"
                      >
                        {savingClose ? '提交中…' : '确认结案'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelClose}
                        className="px-4 py-2 rounded-lg text-sm text-warm-500 hover:text-warm-700 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default CareRecords;
