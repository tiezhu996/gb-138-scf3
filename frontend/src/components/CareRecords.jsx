import { useEffect, useMemo, useState } from 'react';
import { symptomCategories } from '../data/symptoms';
import {
  closeCareRecord,
  createCareRecord,
  fetchCareRecords,
  generateClientToken,
} from '../api/careRecords';

const EMERGENCY_SEVERITY = 4;
const EMERGENCY_SYMPTOM_ID = 'breathing';

const severityOptions = [
  { value: 1, label: '轻微' },
  { value: 2, label: '轻度' },
  { value: 3, label: '中度' },
  { value: 4, label: '严重' },
  { value: 5, label: '危急' },
];

const severityStyles = {
  1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  2: 'bg-sky-100 text-sky-700 border-sky-200',
  3: 'bg-amber-100 text-amber-700 border-amber-200',
  4: 'bg-orange-100 text-orange-700 border-orange-200',
  5: 'bg-red-100 text-red-700 border-red-200',
};

const isEmergency = (record) =>
  record.severity >= EMERGENCY_SEVERITY || record.symptomId === EMERGENCY_SYMPTOM_ID;

const toLocalInputValue = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formatTime = (iso) =>
  new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const EmergencyBanner = ({ reason }) => (
  <div className="sticky top-[88px] z-30 -mx-2 px-2 mb-8">
    <div className="relative overflow-hidden bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-2xl shadow-2xl shadow-red-300/50 border border-red-500/50">
      <div className="absolute inset-0 animate-pulse bg-red-500/20 pointer-events-none" />
      <div className="relative flex items-start gap-4 px-6 py-5">
        <span className="text-4xl flex-shrink-0">🚑</span>
        <div>
          <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
            紧急就医提醒
            <span className="text-xs font-medium bg-white/20 rounded-full px-2.5 py-0.5">
              页面固定显示
            </span>
          </h3>
          <p className="text-white/90 leading-relaxed">
            {reason}
            当前记录提示存在较高风险，请立即联系主治医护人员，或尽快前往最近医院急诊就诊。
            若出现意识不清、嘴唇发紫、呼吸极度困难，请马上拨打当地急救电话。
          </p>
        </div>
      </div>
    </div>
  </div>
);

const StatCard = ({ icon, label, value, tone }) => (
  <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-white/60 px-5 py-4 text-center">
    <div className="text-2xl mb-1">{icon}</div>
    <div className={`text-2xl font-bold ${tone}`}>{value}</div>
    <div className="text-xs text-warm-500 mt-0.5">{label}</div>
  </div>
);

const CareRecords = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [symptomId, setSymptomId] = useState('');
  const [severity, setSeverity] = useState('');
  const [occurredAt, setOccurredAt] = useState(toLocalInputValue(new Date()));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  // 一次"填写+提交"持有一个 token：失败重试沿用同一 token，成功或清空后换新
  const [clientToken, setClientToken] = useState(generateClientToken);

  const [closingId, setClosingId] = useState(null);
  const [actionError, setActionError] = useState('');

  const applyRecords = async (promise, { showLoading } = {}) => {
    if (showLoading) {
      setLoading(true);
      setLoadError('');
    }
    try {
      setRecords(await promise);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetchCareRecords()
      .then((data) => {
        if (active) setRecords(data);
      })
      .catch((error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const sortedRecords = useMemo(
    () =>
      [...records].sort((a, b) => {
        const byOccurred = b.occurredAt.localeCompare(a.occurredAt);
        return byOccurred !== 0 ? byOccurred : b.createdAt.localeCompare(a.createdAt);
      }),
    [records],
  );

  const openCount = records.filter((record) => record.status === 'open').length;
  const closedCount = records.length - openCount;
  const emergencyRecords = records.filter(isEmergency);

  // 表单中已选条件触发的紧急提醒：严重度达到 4，或选择了呼吸困难
  const formEmergencySeverity = Number(severity) >= EMERGENCY_SEVERITY;
  const formEmergencySymptom = symptomId === EMERGENCY_SYMPTOM_ID;
  const formEmergency = formEmergencySeverity || formEmergencySymptom;
  const showEmergency = formEmergency || emergencyRecords.length > 0;

  const emergencyReason = formEmergency
    ? formEmergencySeverity
      ? '严重度已达到 4 级及以上。'
      : '已选择"呼吸困难"。'
    : `已有 ${emergencyRecords.length} 条记录需要紧急关注。`;

  const resetForm = () => {
    setSymptomId('');
    setSeverity('');
    setOccurredAt(toLocalInputValue(new Date()));
    setNotes('');
    setFormError('');
    // 新的一次填写使用新 token，避免与上一次提交被视为同一提交
    setClientToken(generateClientToken());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setActionError('');

    if (!symptomId) {
      setFormError('请从已有症状中选择一个症状');
      return;
    }
    if (!severity) {
      setFormError('请选择严重度');
      return;
    }
    if (!occurredAt) {
      setFormError('请填写发生时间');
      return;
    }
    if (!notes.trim()) {
      setFormError('请填写观察说明后再提交（无说明的记录不能提交，也不能结案）');
      return;
    }

    setFormError('');
    setSubmitting(true);
    try {
      const created = await createCareRecord({
        symptomId,
        severity: Number(severity),
        occurredAt,
        notes: notes.trim(),
        clientToken,
      });
      // 只有服务器确认成功后才更新列表和计数；失败时保持现状不动
      setRecords((current) =>
        current.some((record) => record.id === created.id)
          ? current
          : [...current, created],
      );
      resetForm();
    } catch (error) {
      // 保存失败：不改动现有列表和计数，保留已填写内容供修改后重试
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (id) => {
    setActionError('');
    setClosingId(id);
    try {
      const closed = await closeCareRecord(id);
      setRecords((current) =>
        current.map((record) => (record.id === closed.id ? closed : record)),
      );
    } catch (error) {
      setActionError(error.message);
    } finally {
      setClosingId(null);
    }
  };

  return (
    <section className="mt-20">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-sky-600 font-medium mb-6 shadow-sm border border-sky-100">
          <span>📒</span>
          <span>持续照护 · 留痕可追溯</span>
        </div>
        <h2 className="text-3xl font-bold text-warm-900 mb-3">可持续照护记录</h2>
        <p className="text-warm-600 max-w-2xl mx-auto leading-relaxed">
          从已有症状中选择并记录本次观察，记录会长期保存，服务重启后依然可见。
          严重度达到 4 级或出现呼吸困难时，请立即带患者就医。
        </p>
      </div>

      {showEmergency && <EmergencyBanner reason={emergencyReason} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="📋" label="照护记录总数" value={records.length} tone="text-warm-800" />
        <StatCard icon="⏳" label="跟进中" value={openCount} tone="text-sky-600" />
        <StatCard icon="✅" label="已结案" value={closedCount} tone="text-emerald-600" />
        <StatCard
          icon="🚨"
          label="需紧急关注"
          value={emergencyRecords.length}
          tone={emergencyRecords.length > 0 ? 'text-red-600' : 'text-warm-800'}
        />
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative overflow-hidden bg-white/85 backdrop-blur-sm rounded-3xl shadow-xl p-8 mb-8 border border-white/60"
      >
        <h3 className="text-xl font-bold text-warm-800 mb-6 flex items-center gap-2">
          <span>✏️</span> 新增照护记录
        </h3>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-2">
              症状 <span className="text-red-500">*</span>
            </label>
            <select
              value={symptomId}
              onChange={(event) => setSymptomId(event.target.value)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-sky-100 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all outline-none bg-white/70 text-warm-800"
            >
              <option value="">请选择已有症状…</option>
              {symptomCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-warm-700 mb-2">
              发生时间 <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className="w-full px-4 py-3 rounded-2xl border-2 border-sky-100 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all outline-none bg-white/70 text-warm-800"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-warm-700 mb-2">
            严重度 <span className="text-red-500">*</span>
            <span className="ml-2 font-normal text-warm-400">1 轻微 → 5 危急（达到 4 级将显示紧急就医提醒）</span>
          </label>
          <div className="grid grid-cols-5 gap-3">
            {severityOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => setSeverity(option.value)}
                className={`py-3 rounded-2xl border-2 font-semibold transition-all duration-200 ${
                  severity === option.value
                    ? severityStyles[option.value] + ' scale-105 shadow-md'
                    : 'border-sky-100 bg-white/60 text-warm-500 hover:border-sky-300 hover:bg-sky-50'
                }`}
              >
                <span className="block text-lg leading-none">{option.value}</span>
                <span className="block text-xs mt-1">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-warm-700 mb-2">
            观察说明 <span className="text-red-500">*</span>
            <span className="ml-2 font-normal text-warm-400">
              记录患者表现、处置方式与反应；未填写说明不能提交，也不能结案
            </span>
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="例如：午后疼痛加重，遵医嘱服药后约 30 分钟缓解，患者可安静休息……"
            className="w-full px-4 py-3 rounded-2xl border-2 border-sky-100 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 transition-all outline-none bg-white/70 text-warm-800 resize-y"
          />
          <div className="text-right text-xs text-warm-400 mt-1">{notes.length}/1000</div>
        </div>

        {formEmergency && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">🚑</span>
            <p className="text-red-700 text-sm leading-relaxed">
              {formEmergencySeverity && '严重度已达到 4 级及以上。'}
              {formEmergencySeverity && formEmergencySymptom && '同时'}
              {formEmergencySymptom && '已选择"呼吸困难"。'}
              该记录保存后请立即联系医护人员或前往急诊，页面将固定显示紧急就医提醒。
            </p>
          </div>
        )}

        {formError && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-amber-800 text-sm flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <span>记录未保存，现有列表未改动：{formError}</span>
          </div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl font-bold hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
          >
            {submitting ? '保存中…' : '保存记录'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={submitting}
            className="px-6 py-3.5 bg-white/70 text-warm-600 rounded-2xl font-semibold border border-warm-200 hover:bg-warm-50 transition-colors disabled:opacity-50"
          >
            清空重填
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-warm-800 flex items-center gap-2 px-1">
          <span>🕘</span> 照护记录
          <span className="text-sm font-normal text-warm-400">按发生时间倒序</span>
        </h3>

        {loading ? (
          <div className="bg-white/80 rounded-3xl shadow-lg p-12 text-center text-warm-500 border border-white/60">
            正在加载照护记录…
          </div>
        ) : loadError ? (
          <div className="bg-white/80 rounded-3xl shadow-lg p-10 text-center border border-white/60">
            <p className="text-red-600 font-semibold mb-2">记录加载失败：{loadError}</p>
            <p className="text-warm-500 text-sm mb-5">请检查后端服务是否正常后重试。</p>
            <button
              type="button"
              onClick={() => applyRecords(fetchCareRecords(), { showLoading: true })}
              className="px-6 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all"
            >
              重新加载
            </button>
          </div>
        ) : sortedRecords.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg p-12 text-center border border-white/60">
            <div className="text-6xl mb-4">📒</div>
            <h4 className="text-xl font-bold text-warm-800 mb-2">还没有照护记录</h4>
            <p className="text-warm-500">使用上方表单，为患者留下第一条可持续照护记录。</p>
          </div>
        ) : (
          sortedRecords.map((record) => (
            <div
              key={record.id}
              className={`relative bg-white/85 backdrop-blur-sm rounded-2xl shadow-md hover:shadow-xl transition-shadow p-6 border ${
                isEmergency(record) ? 'border-red-200' : 'border-white/60'
              } ${record.status === 'closed' ? 'opacity-80' : ''}`}
            >
              {isEmergency(record) && (
                <span className="absolute top-0 right-6 -translate-y-1/2 bg-gradient-to-r from-red-600 to-rose-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                  🚑 紧急就医
                </span>
              )}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{record.symptomIcon || '📌'}</span>
                  <div>
                    <h4 className="text-lg font-bold text-warm-800">{record.symptomTitle}</h4>
                    <p className="text-xs text-warm-400">发生时间：{formatTime(record.occurredAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold border ${severityStyles[record.severity]}`}
                  >
                    {record.severity} 级 · {severityOptions[record.severity - 1].label}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                      record.status === 'closed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-sky-50 text-sky-700 border-sky-200'
                    }`}
                  >
                    {record.status === 'closed' ? '✅ 已结案' : '⏳ 跟进中'}
                  </span>
                </div>
              </div>

              <p className="text-warm-700 leading-relaxed bg-sky-50/50 rounded-xl px-4 py-3 border-l-4 border-sky-300 whitespace-pre-wrap">
                {record.notes}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-xs text-warm-400">
                <div>
                  记录于 {formatTime(record.createdAt)}
                  {record.status === 'closed' && record.closedAt && (
                    <span className="ml-3">结案于 {formatTime(record.closedAt)}</span>
                  )}
                </div>
                {record.status === 'open' && (
                  <button
                    type="button"
                    onClick={() => handleClose(record.id)}
                    disabled={closingId === record.id || !record.notes?.trim()}
                    title={record.notes?.trim() ? '结案后原始记录仍完整保留' : '未填写说明的记录不能结案'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    {closingId === record.id ? '结案中…' : '结案并保留记录'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {actionError && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-amber-800 text-sm flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <span>操作失败，列表和计数未改动：{actionError}</span>
        </div>
      )}
    </section>
  );
};

export default CareRecords;
