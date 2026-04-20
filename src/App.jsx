import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Sparkles, AlertCircle, ChevronRight, RotateCcw,
  BrainCircuit, GraduationCap, FileText, XCircle, ArrowLeft,
  FileUp, Key, Eye, EyeOff, Lock, History, Trash2, Calendar, File, Terminal
} from 'lucide-react';

const MASTER_ACCESS_CODE = "ghlee"; 
const MODEL_NAME = "gemini-1.5-flash"; // 가장 안정적인 표준 모델명

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
      localStorage.setItem('app_authorized', 'true');
    } else { setAccessError(true); }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({ name: file.name, data: reader.result.split(',')[1], type: file.type });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const saveToHistory = (qs, answers) => {
    const score = qs.reduce((acc, q, idx) => acc + (answers[idx] === q.answer ? 1 : 0), 0);
    const newEntry = {
      id: Date.now(), date: new Date().toLocaleString(),
      title: selectedFile ? `[PDF] ${selectedFile.name}` : (lectureNotes.substring(0, 30) + "..."),
      questions: qs, userAnswers: answers, score, total: qs.length, difficulty
    };
    const updated = [newEntry, ...quizHistory];
    setQuizHistory(updated);
    localStorage.setItem('quiz_history', JSON.stringify(updated));
  };

  async function fetchQuestions() {
    // API 주소 형식을 가장 표준적인 v1beta로 고정
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    const systemPrompt = `교육 전문가로서 다음 자료로 ${questionCount}개의 객관식 문제를 만드세요. 난이도: ${difficulty}. 반드시 JSON 배열 형식으로만 응답하세요. [{"question": "질문", "options": ["1","2","3","4"], "answer": 0, "explanation": "해설"}]`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: systemPrompt },
          ...(selectedFile ? [{ inlineData: { mimeType: selectedFile.type, data: selectedFile.data } }] : []),
          { text: lectureNotes || "첨부된 자료를 분석하세요." }
        ]}]
      })
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.message || "API 연결 실패");
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  }

  const handleGenerate = async () => {
    if (!apiKey) { setError("API 키를 입력해주세요."); return; }
    setView('generating');
    setError(null); setDebugLog(null);
    try {
      const data = await fetchQuestions();
      setQuestions(Array.isArray(data) ? data : [data]);
      setUserAnswers({}); setCurrentQuestionIndex(0); setView('quiz');
    } catch (err) {
      setError("문제 생성에 실패했습니다.");
      setDebugLog(err.message);
      setView('input');
    }
  };

  if (!isAuthorized) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] p-10 text-center space-y-6">
        <Lock size={48} className="mx-auto text-blue-600" />
        <h2 className="text-xl font-bold">액세스 코드 입력</h2>
        <form onSubmit={handleAuthorize} className="space-y-4">
          <input type="password" placeholder="코드를 입력하세요" className="w-full p-4 bg-slate-50 border rounded-xl text-center font-bold" value={accessInput} onChange={(e) => setAccessInput(e.target.value)} />
          <button className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold">진입</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 flex flex-col items-center">
      {view === 'input' && (
        <div className="max-w-4xl w-full space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center px-2">
            <button onClick={() => setView('history')} className="px-5 py-3 bg-white text-blue-600 rounded-2xl text-sm font-bold border border-blue-100 shadow-sm flex items-center gap-2">
              <History size={18} /> 학습 기록
            </button>
            <button onClick={() => { setIsAuthorized(false); localStorage.removeItem('app_authorized'); }} className="text-slate-400 text-xs font-bold">로그아웃</button>
          </div>
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-3xl font-black text-slate-900">AI 문제 생성기</h1>
            <p className="text-slate-500 text-sm">PDF를 올리면 AI가 직접 분석하여 문제를 만듭니다.</p>
          </div>
          <div className="bg-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between font-bold text-sm">
              <span className="flex items-center gap-2"><Key size={18} /> Gemini API 키</span>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs bg-white/20 px-3 py-1 rounded-full">키 발급</a>
            </div>
            <div className="relative">
              <input type={showKey ? "text" : "password"} className="w-full bg-white/10 border border-white/20 rounded-2xl py-3 px-5 outline-none text-sm" placeholder="API 키를 입력하세요" value={apiKey} onChange={(e) => { setApiKey(e.target.value.trim()); localStorage.setItem('gemini_api_key', e.target.value.trim()); }} />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>
          <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-10 space-y-6 border border-slate-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div onClick={() => !selectedFile && fileInputRef.current.click()} className={`h-48 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center cursor-pointer ${selectedFile ? 'border-blue-200 bg-blue-50' : 'bg-slate-50'}`}>
                <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                {selectedFile ? <div className="text-center p-4"><File size={32} className="mx-auto text-blue-600 mb-2" /><p className="text-sm font-bold truncate max-w-[200px]">{selectedFile.name}</p><button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-xs text-red-500 mt-2">취소</button></div> : <div className="text-center text-slate-400"><FileUp size={32} className="mx-auto mb-2" /><p className="text-sm font-bold">PDF 업로드</p></div>}
              </div>
              <textarea className="w-full h-48 p-4 bg-slate-50 border rounded-3xl outline-none text-sm" placeholder="추가 지시사항 (예: 5장 위주로 출제해줘)" value={lectureNotes} onChange={(e) => setLectureNotes(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2"><label className="text-xs font-bold text-slate-500 ml-2">난이도</label><div className="flex bg-slate-100 p-1 rounded-xl">{['Low', 'Medium', 'High'].map(l => (<button key={l} onClick={() => setDifficulty(l)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${difficulty === l ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{l === 'Low' ? '하' : l === 'Medium' ? '중' : '상'}</button>))}</div></div>
              <div className="space-y-2"><label className="text-xs font-bold text-slate-500 ml-2">문제 수</label><div className="flex bg-slate-100 p-1 rounded-xl">{[5, 10, 20].map(n => (<button key={n} onClick={() => setQuestionCount(n)} className={`flex-1 py-2 rounded-lg text-xs font-bold ${questionCount === n ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{n}개</button>))}</div></div>
              <button onClick={handleGenerate} className="h-[52px] mt-auto bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Sparkles size={18} /> 문제 생성</button>
            </div>
            {error && <div className="space-y-2"><div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100"><AlertCircle size={14} /> {error}</div>{debugLog && <div className="p-3 bg-slate-900 text-slate-300 rounded-xl text-[10px] font-mono"><Terminal size={10} className="mb-1 text-blue-400" /> {debugLog}</div>}</div>}
          </div>
        </div>
      )}
      {view === 'generating' && <div className="flex flex-col items-center justify-center space-y-6 min-h-[60vh]"><div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div><h2 className="text-xl font-bold text-slate-800">AI가 자료를 분석 중입니다...</h2></div>}
      {view === 'quiz' && (
        <div className="max-w-3xl w-full space-y-6 animate-in slide-in-from-right-8 duration-500">
          <div className="flex justify-between px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><span>{difficulty} LEVEL</span><span>{currentQuestionIndex + 1} / {questions.length}</span></div>
          <div className="bg-white rounded-[2rem] shadow-xl p-8 space-y-8 border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 leading-snug">{questions[currentQuestionIndex].question}</h2>
            <div className="space-y-3">{questions[currentQuestionIndex].options.map((opt, idx) => (<button key={idx} onClick={() => setUserAnswers({ ...userAnswers, [currentQuestionIndex]: idx })} className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 ${userAnswers[currentQuestionIndex] === idx ? 'border-blue-500 bg-blue-50' : 'border-slate-50 hover:bg-slate-50'}`}><span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${userAnswers[currentQuestionIndex] === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{String.fromCharCode(65 + idx)}</span><span className="font-bold text-slate-700">{opt}</span></button>))}</div>
            <div className="flex justify-end pt-6 border-t"><button onClick={() => { if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1); else { saveToHistory(questions, userAnswers); setView('result'); } }} disabled={userAnswers[currentQuestionIndex] === undefined} className="px-10 py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center gap-2 active:scale-95 transition-all">{currentQuestionIndex === questions.length - 1 ? '완료' : '다음'} <ChevronRight size={18} /></button></div>
          </div>
        </div>
      )}
      {view === 'result' && (
        <div className="max-w-2xl w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
          <div className="bg-white rounded-[3rem] shadow-xl p-12 border border-slate-100">
            <GraduationCap size={64} className="mx-auto text-blue-600 mb-6" />
            <h2 className="text-2xl font-bold mb-2">학습 완료</h2>
            <div className="text-7xl font-black text-blue-600 mb-10">{questions.reduce((acc, q, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0)} <span className="text-2xl text-slate-300">/ {questions.length}</span></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><button onClick={() => setView('review')} className="py-4 bg-red-50 text-red-600 rounded-2xl font-bold flex flex-col items-center gap-1 border border-red-100"><FileText size={24} /> 오답 복기</button><button onClick={() => setView('input')} className="py-4 bg-slate-900 text-white rounded-2xl font-bold flex flex-col items-center gap-1"><RotateCcw size={24} /> 다시 시작</button></div>
          </div>
        </div>
      )}
      {view === 'review' && (
        <div className="max-w-3xl w-full space-y-6 animate-in slide-in-from-bottom-8 duration-500 pb-20">
          <button onClick={() => setView('result')} className="flex items-center gap-2 text-slate-500 font-bold"><ArrowLeft size={18} /> 결과로</button>
          <div className="space-y-6">{questions.map((q, idx) => (<div key={idx} className={`bg-white rounded-3xl p-6 border-2 ${userAnswers[idx] === q.answer ? 'border-green-50' : 'border-red-50'}`}><div className="flex items-start gap-4 mb-4"><span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black ${userAnswers[idx] === q.answer ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{idx + 1}</span><h3 className="font-bold text-slate-800">{q.question}</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 md:ml-12"><div className={`p-3 rounded-xl border text-xs font-bold ${userAnswers[idx] === q.answer ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>선택: {q.options[userAnswers[idx]] || '없음'}</div><div className="p-3 rounded-xl bg-slate-50 border text-xs font-bold text-slate-700">정답: {q.options[q.answer]}</div></div><div className="md:ml-12 p-4 bg-blue-50 text-slate-600 text-sm rounded-xl border border-blue-100 font-medium">{q.explanation}</div></div>))}</div>
        </div>
      )}
      {view === 'history' && (
        <div className="max-w-3xl w-full space-y-6 animate-in slide-in-from-left-4 duration-300 pb-20">
          <button onClick={() => setView('input')} className="flex items-center gap-2 text-slate-500 font-bold"><ArrowLeft size={18} /> 뒤로</button>
          {quizHistory.length === 0 ? <div className="bg-white rounded-[2rem] p-20 text-center border-2 border-dashed border-slate-100"><p className="text-slate-400 font-bold italic">기록이 없습니다.</p></div> : <div className="space-y-4">{quizHistory.map(item => (<div key={item.id} onClick={() => { setQuestions(item.questions); setUserAnswers(item.userAnswers); setView('result'); }} className="bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all flex items-center justify-between cursor-pointer"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-black">{Math.round((item.score / item.total) * 100)}</div><div className="space-y-0.5"><h3 className="font-bold text-slate-800 truncate max-w-[200px]">{item.title}</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest"><Calendar size={10} className="inline mr-1" /> {item.date}</p></div></div><button onClick={(e) => { e.stopPropagation(); const updated = quizHistory.filter(h => h.id !== item.id); setQuizHistory(updated); localStorage.setItem('quiz_history', JSON.stringify(updated)); }} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={18} /></button></div>))}</div>}
        </div>
      )}
    </div>
  );
}


