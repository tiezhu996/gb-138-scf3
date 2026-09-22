import { useState } from 'react';
import { Link } from 'react-router-dom';
import { symptomCategories } from '../data/symptoms';
import CareRecords from '../components/CareRecords';

const Symptoms = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [view, setView] = useState('categories'); // categories | detail | records
  const [presetSymptomId, setPresetSymptomId] = useState(null);
  const [recordsSession, setRecordsSession] = useState(0);
  const [hasUrgent, setHasUrgent] = useState(false);

  const gradients = {
    pain: 'from-sky-400 to-blue-600',
    breathing: 'from-cyan-400 to-teal-600',
    nausea: 'from-lime-400 to-green-600',
    fatigue: 'from-amber-400 to-orange-600',
    constipation: 'from-orange-400 to-red-500',
    sleep: 'from-indigo-400 to-purple-600'
  };

  const openRecords = (symptomId = null) => {
    setPresetSymptomId(symptomId);
    setRecordsSession((value) => value + 1);
    setSelectedCategory(null);
    setView('records');
  };

  const backToCategories = () => {
    setView('categories');
    setSelectedCategory(null);
  };

  const openDetail = (category) => {
    setSelectedCategory(category);
    setView('detail');
  };

  const showUrgentBanner = view === 'records' && hasUrgent;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-cyan-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
      </div>

      {showUrgentBanner && (
        <div className="sticky top-0 z-30 bg-red-600 text-white shadow-lg">
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-center gap-3 text-center">
            <span className="text-xl flex-shrink-0">🚨</span>
            <p className="text-sm md:text-base font-bold leading-tight">
              紧急就医提醒：记录中存在呼吸困难或严重度达到 4 分及以上的症状，请立即联系医护人员或拨打急救电话、尽快前往急诊！
            </p>
          </div>
        </div>
      )}

      <header className={`relative bg-white/70 backdrop-blur-md shadow-sm sticky z-20 border-b border-white/50 ${showUrgentBanner ? 'top-14' : 'top-0'}`}>
        <div className="max-w-6xl mx-auto px-6 py-5">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2.5 hover:bg-warm-100 rounded-full transition-colors group"
            >
              <svg className="w-6 h-6 text-warm-600 group-hover:text-sky-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-warm-800">症状管理</h1>
              <p className="text-xs text-warm-500">专业护理建议，缓解患者不适</p>
            </div>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {view === 'records' ? (
          <CareRecords
            key={recordsSession}
            initialSymptomId={presetSymptomId}
            onBack={backToCategories}
            onUrgentChange={setHasUrgent}
          />
        ) : (
          <>
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur-sm rounded-full text-sm text-sky-600 font-medium mb-6 shadow-sm border border-sky-100">
            <span>💊</span>
            <span>科学护理 · 缓解不适</span>
          </div>
          <h2 className="text-4xl font-bold text-warm-900 mb-4">
            常见症状护理指南
          </h2>
          <p className="text-lg text-warm-600 max-w-2xl mx-auto leading-relaxed">
            了解临终阶段常见症状的护理方法，帮助患者缓解不适，提高生活质量。
            请在专业医护人员指导下进行护理。
          </p>
        </div>

        {view === 'categories' && (
          <>
            <button
              onClick={() => openRecords()}
              className="w-full mb-8 flex items-center gap-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all hover:-translate-y-0.5 text-left"
            >
              <span className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-3xl flex-shrink-0">
                📋
              </span>
              <span className="flex-1">
                <span className="block text-xl font-bold mb-1">持续照护记录（家属入口）</span>
                <span className="block text-sm text-sky-100">
                  从已有症状中选择，记录严重度、发生时间与观察说明；记录持续保存，严重度≥4 或呼吸困难将固定提示紧急就医
                </span>
              </span>
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {symptomCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => openDetail(category)}
                  className="group relative overflow-hidden bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border border-white/60 text-left p-6"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-10 group-hover:opacity-20 transition-opacity">
                    <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${gradients[category.id] || 'from-sky-400 to-blue-600'}`} />
                  </div>
                  <div className="relative flex items-start gap-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradients[category.id] || 'from-sky-400 to-blue-600'} flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform flex-shrink-0`}>
                      {category.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-warm-800 mb-2 group-hover:text-sky-600 transition-colors">
                        {category.title}
                      </h3>
                      <p className="text-sm text-warm-500 leading-relaxed">
                        {category.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {view === 'detail' && selectedCategory && (
          <div className="max-w-3xl mx-auto">
            <button
              onClick={backToCategories}
              className="flex items-center gap-2 text-sky-600 hover:text-sky-700 mb-6 transition-colors font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              返回症状列表
            </button>

            <div className="relative overflow-hidden bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl p-8 mb-8 border border-white/60">
              <div className="absolute top-0 right-0 w-48 h-48 opacity-10">
                <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br ${gradients[selectedCategory.id] || 'from-sky-400 to-blue-600'}`} />
              </div>
              <div className="relative flex items-center gap-5 mb-8">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${gradients[selectedCategory.id] || 'from-sky-400 to-blue-600'} flex items-center justify-center text-4xl shadow-xl`}>
                  {selectedCategory.icon}
                </div>
                <div>
                  <h3 className="text-3xl font-bold text-warm-800">
                    {selectedCategory.title}
                  </h3>
                  <p className="text-warm-500 text-lg">{selectedCategory.description}</p>
                </div>
              </div>

              <div className="space-y-5">
                {selectedCategory.tips.map((tip, index) => (
                  <div key={index} className="relative pl-8 py-3 border-l-4 border-sky-400 bg-sky-50/50 rounded-r-xl">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-sm font-bold shadow-md">
                      {index + 1}
                    </div>
                    <h4 className="text-lg font-semibold text-warm-800 mb-2">
                      {tip.title}
                    </h4>
                    <p className="text-warm-600 leading-relaxed">
                      {tip.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => openRecords(selectedCategory.id)}
              className="w-full mb-8 flex items-center gap-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 text-left"
            >
              <span className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                📋
              </span>
              <span className="flex-1">
                <span className="block text-lg font-bold">为「{selectedCategory.title}」记录一次观察</span>
                <span className="block text-sm text-sky-100">填写严重度、发生时间和观察说明，自动归入持续照护记录</span>
              </span>
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="relative overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/30 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <div className="relative flex items-start gap-4">
                <span className="text-4xl flex-shrink-0">⚠️</span>
                <div>
                  <h4 className="font-bold text-amber-800 mb-2 text-lg">重要提醒</h4>
                  <p className="text-amber-700 leading-relaxed">
                    本指南仅供参考，不能替代专业医疗建议。如遇严重症状或症状加重，
                    请立即联系医护人员或前往医院就诊。药物使用请严格遵循医嘱。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      <footer className="relative bg-gradient-to-r from-sky-800 to-blue-900 text-white/80 py-10 mt-20">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">🕊️</span>
            <span className="text-lg font-semibold text-white">安宁疗护信息指南</span>
          </div>
          <p className="text-sm text-white/50 max-w-xl mx-auto">
            本平台仅供信息参考，具体诊疗请遵医嘱。如有紧急情况，请立即就医。
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Symptoms;
