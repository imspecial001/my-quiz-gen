import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sparkles, AlertCircle, ChevronRight, RotateCcw,
  BrainCircuit, GraduationCap, FileText, XCircle, ArrowLeft,
  FileUp, Key, Eye, EyeOff, Lock, History, Trash2, Calendar, File, Terminal, Loader2
} from 'lucide-react';

// --- 관리자 설정 ---
const MASTER_ACCESS_CODE = "ghlee"; 
// ------------------

export default function App() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [accessInput, setAccessInput] = useState('');
  const [accessError, setAccessError] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [view, setView] = useState('input');
  const [lectureNotes, setLectureNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [quizHistory, setQuizHistory] = useState([]);
  const [error, setError] = useState(null);
  const [debugLog, setDebugLog] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedAuth = localStorage.getItem('app_authorized');
    if (savedAuth === 'true') setIsAuthorized(true);
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
    const savedHistory = localStorage.getItem('quiz_history');
    if (savedHistory) setQuizHistory(JSON.parse(savedHistory));
  }, []);

  const handleAuthorize = (e) => {
    e.preventDefault();
    if (accessInput === MASTER_ACCESS_CODE) {
      setIsAuthorized(true);
      setAccessError(false);
      localStorage.setItem('app_authorized', 'true');
    } else {
      setAccessError(true);
      setAccessInput('');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        data: reader.result.split(',')[1],
        type: file.type
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const saveToHistory = (qs, answers) => {
    const score = qs.reduce((acc, q, idx) => acc + (answers[idx] === q.answer ? 1 : 0), 0);
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      title: selectedFile ? `[PDF] ${selectedFile.name}` : (lectureNotes.substring(0, 30) + "..."),
      questions: qs,
      userAnswers: answers,
      score,
      total: qs.length,
      difficulty
    };
    const updated = [newEntry, ...quizHistory];
    setQuizHistory(updated);
    localStorage.setItem('quiz_history', JSON.stringify(updated));
  };

  async function fetchWithRetry() {
    const systemPrompt = `당신은 교육 전문가입니다. 자료를 분석하여 ${questionCount}개의 객관식 문제를 생성하세요. 
    난이도: ${difficulty}. 
    반드시 다음의 JSON 배열 형식으로만 응답하세요: [{"question": "질문", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": 0, "explanation": "해설"}]`;

    // 2026년 기준 가장 작동 확률이 높은 모델 이름들
    const models = ["gemini-1.5-flash", "gemini-1.5-pro"];

    for (const modelId of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: systemPrompt },
              ...(selectedFile ? [{ inlineData: { mimeType: selectedFile.type, data: selectedFile.data } }] : []),
              { text: lectureNotes || "자료를 읽고 문제를 생성해줘." }
            ]}],
            generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
          })
        });

        const result = await response.json();
        if (response.ok) {
          const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
          return JSON.parse(text);
        } else if (response.status !== 404) {
          throw new Error(result.error?.message || "API 통신 장애");
        }
      } catch (err) {
        if (modelId === models[models.length - 1]) throw err;
        continue; // 다음 모델 시도
      }
    }
  }

  const handleGenerate = async () => {
    if (!apiKey) { setError("API 키를 먼저 입력해주세요."); return; }
    setIsGenerating(true);
    setView('generating');
    setError(null);
    setDebugLog(null);
    
    try {
      const data = await fetchWithRetry();
      setQuestions(Array.isArray(data) ? data : [data]);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setView('quiz');
    } catch (err) {
      setError("문제 생성에 실패했습니다.");
      setDebugLog(err.message);
      setView('input');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-12 text-center space-y-8 shadow-2xl animate-in fade-in zoom-in-95 duration-500">
          <div className="mx-auto w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center shadow-inner"><Lock size={48} /></div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Access Lock</h1>
            <p className="text-slate-400 text-sm font-medium">관리자 코드를 입력해야 사용할 수 있습니다.</p>
          </div>
          <form onSubmit={handleAuthorize} className="space-y-4">
            <input
              type="password"
              placeholder="코드를 입력하세요"
              className={`w-full p-5 bg-slate-50 border-2 rounded-2xl text-center font-bold outline-none transition-all ${accessError ? 'border-red-500 animate-shake' : 'border-slate-100 focus:border-blue-500'}`}
              value={accessInput}
              onChange={(e) => setAccessInput(e.target.value)}
            />
            <button className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 active:scale-95 transition-all">앱 잠금 해제</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 flex flex-col items-center p-4 md:p-10 relative overflow-x-hidden">
      
      {view === 'input' && (
        <div className="max-w-4xl w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center px-2">
            <button onClick={() => setView('history')} className="px-5 py-3 bg-white text-blue-600 rounded-2xl text-sm font-bold flex items-center gap-2 border border-blue-100 shadow-sm hover:bg-blue-50">
              <History size={18} /> 학습 기록 보관소
            </button>
            <button onClick={() => { setIsAuthorized(false); localStorage.removeItem('app_authorized'); }} className="text-slate-300 hover:text-red-500 text-xs font-black transition-colors">로그아웃</button>
          </div>

          <div className="text-center space-y-3 mb-10 pt-4">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-4">
              <BrainCircuit className="text-blue-600 w-12 h-12" /> AI 문제 생성기
            </h1>
            <p className="text-slate-500 font-medium text-lg italic">나만의 학습 자료를 퀴즈로 만드세요.</p>
          </div>

          <div className="bg-slate-900 rounded-[2rem] p-8 text-white space-y-5 shadow-2xl">
            <div className="flex items-center justify-between font-bold text-sm">
              <span className="flex items-center gap-2 text-blue-400"><Key size={18} /> API 설정</span>
              <a href="[https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)" target="_blank" rel="noreferrer" className="text-xs bg-white/10 px-4 py-1.5 rounded-full hover:bg-white/20 transition-all">새 키 발급</a>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 pr-14 outline-none text-sm font-mono focus:border-blue-500 transition-all"
                placeholder="Gemini API 키를 붙여넣으세요"
                value={apiKey}
                onChange={(e) => { 
                  const val = e.target.value.trim();
                  setApiKey(val); 
                  localStorage.setItem('gemini_api_key', val); 
                }}
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-5 top-1/2 -translate-y-1/2 text-white/30">{showKey ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] shadow-2xl p-6 md:p-12 space-y-8 border border-slate-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div 
                onClick={() => !selectedFile && fileInputRef.current.click()}
                className={`h-64 border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center transition-all cursor-pointer ${selectedFile ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
              >
                <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                {selectedFile ? (
                  <div className="text-center p-6 space-y-4">
                    <div className="mx-auto w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg animate-bounce-short"><File size={32} /></div>
                    <div className="space-y-1">
                      <p className="font-black text-blue-900 text-sm truncate max-w-[200px]">{selectedFile.name}</p>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-xs text-red-500 font-bold hover:underline">파일 취소</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-3 text-slate-400">
                    <div className="mx-auto w-14 h-14 bg-slate-200 rounded-2xl flex items-center justify-center mb-2"><FileUp size={28} /></div>
                    <p className="text-base font-bold">강의록 PDF 업로드</p>
                    <p className="text-xs font-medium">AI가 직접 내용을 정밀 분석합니다</p>
                  </div>
                )}
              </div>
              <textarea
                className="w-full h-64 p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] focus:border-blue-500 transition-all outline-none text-sm leading-relaxed"
                placeholder="추가 지시사항을 입력하거나 직접 텍스트를 입력하세요 (예: 그림 위주로, 혹은 영어로 출제해줘 등)"
                value={lectureNotes}
                onChange={(e) => setLectureNotes(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">난이도</label>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  {['Low', 'Medium', 'High'].map(l => (
                    <button key={l} onClick={() => setDifficulty(l)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${difficulty === l ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>
                      {l === 'Low' ? '하' : l === 'Medium' ? '중' : '상'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">문제 수</label>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  {[5, 10, 20].map(n => (
                    <button key={n} onClick={() => setQuestionCount(n)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${questionCount === n ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>
                      {n}개
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <button onClick={handleGenerate} className="w-full h-[64px] bg-blue-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-100 active:scale-95 transition-all">
                  <Sparkles size={22} /> 문제 생성하기
                </button>
              </div>
            </div>

            {error && (
              <div className="space-y-3 animate-in shake duration-300">
                <div className="p-5 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-4 border border-red-100">
                  <AlertCircle size={24} /> {error}
                </div>
                {debugLog && (
                  <div className="p-6 bg-slate-900 text-slate-300 rounded-2xl text-[10px] font-mono border border-slate-700 overflow-x-auto shadow-inner">
                    <div className="flex items-center gap-2 text-blue-400 mb-3 font-black uppercase tracking-widest border-b border-white/10 pb-2"><Terminal size={14}/> Technical Log</div>
                    {debugLog}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'generating' && (
        <div className="flex flex-col items-center justify-center space-y-10 min-h-[70vh] animate-in fade-in duration-500">
          <div className="relative">
            <div className="w-32 h-32 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
            <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 w-12 h-12" />
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black text-slate-800 animate-pulse">AI가 자료를 분석하고 있습니다</h2>
            <p className="text-slate-400 font-medium text-lg">여러 AI 모델을 교차 시도 중... 잠시만 기다려주세요.</p>
          </div>
        </div>
      )}

      {view === 'quiz' && (
        <div className="max-w-3xl w-full space-y-6 animate-in slide-in-from-right-8 duration-500 py-6">
          <div className="flex justify-between items-center px-4">
             <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">{difficulty} LEVEL</span>
             <span className="text-slate-400 font-black text-xs">QUESTION {currentQuestionIndex + 1} / {questions.length}</span>
          </div>
          <div className="bg-white rounded-[3.5rem] shadow-2xl p-8 md:p-14 space-y-12 border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1.5 bg-blue-600 transition-all duration-500" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-snug whitespace-pre-wrap pt-4">{questions[currentQuestionIndex].question}</h2>
            <div className="grid grid-cols-1 gap-5">
              {questions[currentQuestionIndex].options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setUserAnswers({ ...userAnswers, [currentQuestionIndex]: idx })}
                  className={`w-full text-left p-6 rounded-[1.8rem] border-2 transition-all flex items-center gap-6 group ${userAnswers[currentQuestionIndex] === idx ? 'border-blue-500 bg-blue-50 ring-8 ring-blue-50 shadow-inner' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg transition-all ${userAnswers[currentQuestionIndex] === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100'}`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="font-bold text-lg text-slate-700">{opt}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-10 border-t border-slate-100">
              <button
                onClick={() => {
                  if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
                  else { saveToHistory(questions, userAnswers); setView('result'); }
                }}
                disabled={userAnswers[currentQuestionIndex] === undefined}
                className="px-14 py-5 bg-slate-900 text-white rounded-[2rem] font-black text-lg flex items-center gap-3 disabled:opacity-20 active:scale-95 transition-all shadow-xl hover:bg-black"
              >
                {currentQuestionIndex === questions.length - 1 ? '최종 결과 확인' : '다음 문제로'} <ChevronRight size={22} />
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'result' && (
        <div className="max-w-3xl w-full text-center space-y-8 animate-in zoom-in-95 duration-700 py-10">
          <div className="bg-white rounded-[4rem] shadow-2xl p-12 md:p-20 border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-3 bg-blue-600"></div>
            <div className="inline-flex p-8 bg-blue-50 text-blue-600 rounded-[2.5rem] mb-12 shadow-inner"><GraduationCap size={80} /></div>
            <h2 className="text-4xl font-black mb-6 text-slate-900 tracking-tight">테스트 완료!</h2>
            
            <div className="flex flex-col items-center mb-16">
                <div className="text-[10rem] font-black text-blue-600 tracking-tighter leading-none mb-6">
                  {questions.reduce((acc, q, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0)}
                  <span className="text-4xl text-slate-200 ml-4">/ {questions.length}</span>
                </div>
                <div className="px-8 py-3 bg-blue-600 text-white rounded-full text-sm font-black uppercase tracking-widest shadow-lg shadow-blue-200">
                    Your Score: {Math.round((questions.reduce((acc, q, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0) / questions.length) * 100)}%
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <button onClick={() => setView('review')} className="py-8 bg-red-50 text-red-600 rounded-[2.5rem] font-black text-xl flex flex-col items-center gap-3 border-2 border-red-100 hover:bg-red-100 transition-all">
                <FileText size={40} /> 오답 복기 노트
              </button>
              <button onClick={() => setView('input')} className="py-8 bg-slate-900 text-white rounded-[2.5rem] font-black text-xl flex flex-col items-center gap-3 hover:bg-black transition-all shadow-2xl">
                <RotateCcw size={40} /> 새로운 테스트
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'review' && (
        <div className="max-w-4xl w-full space-y-8 animate-in slide-in-from-bottom-12 duration-500 pb-24 py-10">
          <div className="flex items-center justify-between px-4">
            <button onClick={() => setView('result')} className="flex items-center gap-3 text-slate-400 font-black text-sm hover:text-slate-900 transition-all uppercase tracking-widest"><ArrowLeft size={24} /> Back to Result</button>
            <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4"><XCircle className="text-red-500" /> 오답 및 해설</h2>
            <div className="w-20"></div>
          </div>
          <div className="space-y-8">
            {questions.map((q, idx) => (
              <div key={idx} className={`bg-white rounded-[3rem] p-10 border-2 shadow-sm relative overflow-hidden ${userAnswers[idx] === q.answer ? 'border-green-50' : 'border-red-50'}`}>
                <div className={`absolute top-0 right-0 px-8 py-3 rounded-bl-3xl font-black text-[10px] uppercase tracking-widest ${userAnswers[idx] === q.answer ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {userAnswers[idx] === q.answer ? 'CORRECT' : 'INCORRECT'}
                </div>
                <div className="flex items-start gap-6 mb-10 pt-4">
                  <span className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl ${userAnswers[idx] === q.answer ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{idx + 1}</span>
                  <h3 className="text-2xl font-bold pt-2 leading-snug whitespace-pre-wrap">{q.question}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 md:ml-20">
                  <div className={`p-6 rounded-[1.8rem] border-2 text-sm font-black ${userAnswers[idx] === q.answer ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    나의 선택: {q.options[userAnswers[idx]] || 'N/A'}
                  </div>
                  <div className="p-6 rounded-[1.8rem] bg-slate-50 border-2 border-slate-100 text-sm font-black text-slate-700">
                    정답: {q.options[q.answer]}
                  </div>
                </div>
                <div className="md:ml-20 p-8 bg-blue-50/50 rounded-[2.2rem] border-2 border-blue-100 relative shadow-inner">
                  <div className="absolute -top-4 left-10 px-5 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest shadow-lg">AI Explanation</div>
                  <p className="text-slate-600 leading-relaxed font-bold pt-4 text-lg">{q.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="max-w-4xl w-full space-y-8 animate-in slide-in-from-left-8 duration-500 pb-20 py-10">
          <div className="flex items-center gap-6 mb-8 px-2">
            <button onClick={() => setView('input')} className="p-5 bg-white text-slate-400 rounded-[1.5rem] border-2 border-slate-100 shadow-sm hover:text-slate-900 transition-all"><ArrowLeft size={32} /></button>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">학습 기록 창고</h2>
          </div>
          {quizHistory.length === 0 ? (
            <div className="bg-white rounded-[4rem] p-28 text-center border-2 border-dashed border-slate-200">
              <History size={100} className="mx-auto text-slate-100 mb-8" />
              <p className="text-slate-400 font-bold text-2xl tracking-tight">아직 저장된 퀴즈가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {quizHistory.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => { setQuestions(item.questions); setUserAnswers(item.userAnswers); setDifficulty(item.difficulty); setView('result'); }} 
                  className="bg-white p-10 rounded-[3rem] border-2 border-slate-50 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-10">
                    <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-[2.2rem] flex flex-col items-center justify-center font-black shadow-inner">
                      <span className="text-3xl leading-none">{item.score}</span>
                      <span className="text-[11px] text-blue-300 mt-2 font-black uppercase">/ {item.total}</span>
                    </div>
                    <div className="space-y-3">
                      <h3 className="font-black text-slate-800 text-2xl truncate max-w-[180px] sm:max-w-md">{item.title}</h3>
                      <div className="flex items-center gap-5 text-xs font-black uppercase tracking-wider">
                        <span className="flex items-center gap-2 text-slate-300"><Calendar size={16}/> {item.date}</span>
                        <span className={`px-4 py-1.5 rounded-full ${item.difficulty === 'Low' ? 'bg-green-100 text-green-700' : item.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{item.difficulty}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner"><ChevronRight size={24}/></div>
                    <button onClick={(e) => { e.stopPropagation(); const updated = quizHistory.filter(h => h.id !== item.id); setQuizHistory(updated); localStorage.setItem('quiz_history', JSON.stringify(updated)); }} className="p-5 text-slate-100 hover:text-red-500 hover:bg-red-50 rounded-[1.5rem] transition-all"><Trash2 size={28} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 배경 장식 (모바일 쾌적함을 위해 간소화) */}
      <div className="fixed -z-10 top-0 left-0 w-full h-full opacity-[0.02] pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px]"></div>
        <div className="absolute -bottom-40 -right-20 w-[800px] h-[800px] bg-indigo-600 rounded-full blur-[180px]"></div>
      </div>
    </div>
  );
}


