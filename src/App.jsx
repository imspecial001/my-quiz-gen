import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Sparkles, 
  AlertCircle, 
  ChevronRight, 
  RotateCcw,
  BrainCircuit,
  GraduationCap,
  FileText,
  XCircle,
  ArrowLeft,
  FileUp,
  Key,
  Eye,
  EyeOff,
  Lock,
  History,
  Trash2,
  Calendar,
  File,
  Terminal,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

// --- 관리자 비밀번호 ---
const MASTER_ACCESS_CODE = "ghlee"; 
// ----------------------

export default function App() {
  // 상태 관리
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
  const [fullErrorInfo, setFullErrorInfo] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const fileInputRef = useRef(null);

  // 초기 로드
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

  // --- API 호출 핵심 로직 ---
  async function generateQuiz() {
    // 2026년 기준 가장 정확한 모델 명칭
    const modelId = "gemini-1.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const systemPrompt = `당신은 교육 전문가입니다. 제공된 자료를 바탕으로 ${questionCount}개의 객관식 문제를 만드세요.
    난이도: ${difficulty}. 
    중요: 반드시 순수한 JSON 배열 형식으로만 응답하세요. 예: [{"question": "...", "options": ["...", "..."], "answer": 0, "explanation": "..."}]`;

    const contents = [{
      parts: [
        { text: systemPrompt },
        ...(selectedFile ? [{ inlineData: { mimeType: selectedFile.type, data: selectedFile.data } }] : []),
        { text: lectureNotes || "첨부된 파일을 분석하여 문제를 만드세요." }
      ]
    }];

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
      })
    });

    const result = await response.json();
    if (!response.ok) {
      throw {
        message: result.error?.message || "API 호출 실패",
        status: response.status,
        raw: JSON.stringify(result, null, 2)
      };
    }

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text);
  }

  const handleStart = async () => {
    if (!apiKey) { setError("API 키를 입력해주세요."); return; }
    setIsGenerating(true);
    setView('generating');
    setError(null);
    setFullErrorInfo(null);

    try {
      const data = await generateQuiz();
      setQuestions(Array.isArray(data) ? data : [data]);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setView('quiz');
    } catch (err) {
      console.error(err);
      setError(err.message || "오류가 발생했습니다.");
      setFullErrorInfo(err.raw || String(err));
      setView('input');
    } finally {
      setIsGenerating(false);
    }
  };

  // --- 화면 구성 ---
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 text-center space-y-8">
          <Lock size={48} className="mx-auto text-blue-600" />
          <h1 className="text-2xl font-black">보안 잠금 해제</h1>
          <form onSubmit={handleAuthorize} className="space-y-4">
            <input
              type="password"
              placeholder="코드를 입력하세요 (ghlee)"
              className={`w-full p-4 bg-slate-50 border-2 rounded-2xl text-center font-bold ${accessError ? 'border-red-500' : 'border-slate-100'}`}
              value={accessInput}
              onChange={(e) => setAccessInput(e.target.value)}
            />
            <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black active:scale-95 transition-all">접속하기</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 flex flex-col items-center p-4 md:p-10 relative">
      
      {view === 'input' && (
        <div className="max-w-4xl w-full space-y-6 animate-in fade-in duration-500">
          <div className="flex justify-between items-center">
            <button onClick={() => setView('history')} className="px-5 py-3 bg-white text-blue-600 rounded-2xl text-sm font-bold border border-blue-100 shadow-sm flex items-center gap-2">
              <History size={18} /> 학습 기록
            </button>
            <button onClick={() => { setIsAuthorized(false); localStorage.removeItem('app_authorized'); }} className="text-slate-400 text-xs font-bold">로그아웃</button>
          </div>

          <div className="text-center space-y-3 mb-8">
            <h1 className="text-4xl font-black text-slate-900 flex items-center justify-center gap-4">
              <BrainCircuit className="text-blue-600 w-12 h-12" /> AI 문제 생성기
            </h1>
            <p className="text-slate-500 font-medium">강의 자료를 바탕으로 고품질 퀴즈를 생성합니다.</p>
          </div>

          <div className="bg-slate-800 rounded-[2rem] p-6 text-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between font-bold text-sm text-blue-400">
              <span className="flex items-center gap-2"><Key size={18} /> Gemini API 키</span>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-xs bg-white/10 px-3 py-1 rounded-full text-white">키 발급처</a>
            </div>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-5 outline-none text-sm font-mono"
                placeholder="복사한 API 키를 여기에 붙여넣으세요"
                value={apiKey}
                onChange={(e) => { 
                  const val = e.target.value.trim();
                  setApiKey(val); 
                  localStorage.setItem('gemini_api_key', val); 
                }}
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">{showKey ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-2xl p-6 md:p-10 space-y-8 border border-slate-100">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div 
                onClick={() => !selectedFile && fileInputRef.current.click()}
                className={`h-56 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all cursor-pointer ${selectedFile ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
              >
                <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                {selectedFile ? (
                  <div className="text-center p-4">
                    <CheckCircle2 size={32} className="mx-auto text-blue-600 mb-2" />
                    <p className="font-bold text-blue-900 text-sm truncate max-w-[200px]">{selectedFile.name}</p>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="text-xs text-red-500 font-bold mt-2">파일 취소</button>
                  </div>
                ) : (
                  <div className="text-center space-y-2 text-slate-400">
                    <FileUp size={32} className="mx-auto" />
                    <p className="text-sm font-bold">PDF 업로드</p>
                  </div>
                )}
              </div>
              <textarea
                className="w-full h-56 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:border-blue-500 transition-all outline-none text-sm"
                placeholder="추가 지시사항 (예: 2장 위주로 출제해줘 등)"
                value={lectureNotes}
                onChange={(e) => setLectureNotes(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">난이도</label>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  {['Low', 'Medium', 'High'].map(l => (
                    <button key={l} onClick={() => setDifficulty(l)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${difficulty === l ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>
                      {l === 'Low' ? '하' : l === 'Medium' ? '중' : '상'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">문제 수</label>
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  {[5, 10, 20].map(n => (
                    <button key={n} onClick={() => setQuestionCount(n)} className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${questionCount === n ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400'}`}>
                      {n}개
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <button onClick={handleStart} className="w-full h-[60px] bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-blue-100 active:scale-95 transition-all">
                  <Sparkles size={20} /> 문제 생성 시작
                </button>
              </div>
            </div>

            {error && (
              <div className="space-y-3 animate-in shake duration-300">
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100">
                  <AlertTriangle size={20} /> {error}
                </div>
                {fullErrorInfo && (
                  <div className="p-4 bg-slate-900 text-slate-300 rounded-xl text-[10px] font-mono overflow-x-auto">
                    <Terminal size={12} className="mb-2 text-blue-400" />
                    {fullErrorInfo}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'generating' && (
        <div className="flex flex-col items-center justify-center space-y-8 min-h-[70vh]">
          <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-slate-800 animate-pulse">자료를 분석하고 있습니다</h2>
            <p className="text-slate-500 font-medium text-sm">잠시만 기다려주세요.</p>
          </div>
        </div>
      )}

      {view === 'quiz' && (
        <div className="max-w-3xl w-full space-y-6 animate-in slide-in-from-right-8 duration-500">
          <div className="flex justify-between px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>{difficulty} LEVEL</span>
            <span>{currentQuestionIndex + 1} / {questions.length}</span>
          </div>
          <div className="bg-white rounded-[3rem] shadow-2xl p-8 md:p-14 space-y-10 border border-slate-100">
            <h2 className="text-2xl font-bold text-slate-800 leading-snug">{questions[currentQuestionIndex].question}</h2>
            <div className="space-y-3">
              {questions[currentQuestionIndex].options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => setUserAnswers({ ...userAnswers, [currentQuestionIndex]: idx })}
                  className={`w-full text-left p-6 rounded-3xl border-2 transition-all flex items-center gap-5 ${userAnswers[currentQuestionIndex] === idx ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${userAnswers[currentQuestionIndex] === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="font-bold text-slate-700">{opt}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-6 border-t border-slate-100">
              <button
                onClick={() => {
                  if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
                  else { saveToHistory(questions, userAnswers); setView('result'); }
                }}
                disabled={userAnswers[currentQuestionIndex] === undefined}
                className="px-12 py-4 bg-slate-900 text-white rounded-[2rem] font-black flex items-center gap-2 shadow-lg"
              >
                {currentQuestionIndex === questions.length - 1 ? '결과 보기' : '다음 문제'} <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'result' && (
        <div className="max-w-3xl w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
          <div className="bg-white rounded-[4rem] shadow-2xl p-10 md:p-20 border border-slate-100">
            <GraduationCap size={64} className="mx-auto text-blue-600 mb-8" />
            <h2 className="text-3xl font-black mb-4 text-slate-900">학습 완료</h2>
            <div className="text-8xl font-black text-blue-600 tracking-tighter mb-10">
              {questions.reduce((acc, q, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0)}
              <span className="text-3xl text-slate-300 ml-4">/ {questions.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => setView('review')} className="py-6 bg-red-50 text-red-600 rounded-[2rem] font-black text-xl flex flex-col items-center gap-2 border border-red-100">
                <FileText size={32} /> 오답 복기
              </button>
              <button onClick={() => setView('input')} className="py-6 bg-slate-900 text-white rounded-[2rem] font-black text-xl flex flex-col items-center gap-2">
                <RotateCcw size={32} /> 다시 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'review' && (
        <div className="max-w-4xl w-full space-y-8 animate-in slide-in-from-bottom-8 duration-500 pb-20">
          <div className="flex items-center justify-between px-4">
            <button onClick={() => setView('result')} className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition-all"><ArrowLeft size={20} /> 뒤로</button>
            <h2 className="text-2xl font-black text-slate-800">오답 복기</h2>
            <div className="w-10"></div>
          </div>
          <div className="space-y-6">
            {questions.map((q, idx) => (
              <div key={idx} className={`bg-white rounded-3xl p-8 border-2 ${userAnswers[idx] === q.answer ? 'border-green-50' : 'border-red-50'}`}>
                <div className="flex items-start gap-4 mb-6">
                  <span className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black ${userAnswers[idx] === q.answer ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>{idx + 1}</span>
                  <h3 className="text-xl font-bold pt-1 leading-snug">{q.question}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 md:ml-14">
                  <div className={`p-4 rounded-2xl border text-sm font-bold ${userAnswers[idx] === q.answer ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>나의 선택: {q.options[userAnswers[idx]] || '없음'}</div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700">정답: {q.options[q.answer]}</div>
                </div>
                <div className="md:ml-14 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 relative shadow-sm">
                  <div className="absolute -top-3 left-6 px-2 bg-blue-600 text-white text-[10px] font-black rounded uppercase">AI Analysis</div>
                  <p className="text-slate-600 leading-relaxed font-medium pt-2 text-sm">{q.explanation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="max-w-4xl w-full space-y-6 animate-in slide-in-from-left-4 duration-300 pb-20">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => setView('input')} className="p-3 bg-white text-slate-500 rounded-2xl border border-slate-100 shadow-sm hover:text-slate-800 transition-all"><ArrowLeft size={24} /></button>
            <h2 className="text-2xl font-black text-slate-800">학습 기록</h2>
          </div>
          {quizHistory.length === 0 ? (
            <div className="bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-slate-200">
              <History size={60} className="mx-auto text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold text-xl">저장된 기록이 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {quizHistory.map(item => (
                <div key={item.id} onClick={() => { setQuestions(item.questions); setUserAnswers(item.userAnswers); setView('result'); }} className="bg-white p-6 rounded-3xl border border-slate-50 shadow-sm hover:shadow-lg transition-all flex items-center justify-between cursor-pointer group">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl">{Math.round((item.score / item.total) * 100)}</div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-md">{item.title}</h3>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold uppercase"><Calendar size={10}/> {item.date}</div>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); const updated = quizHistory.filter(h => h.id !== item.id); setQuizHistory(updated); localStorage.setItem('quiz_history', JSON.stringify(updated)); }} className="p-3 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={20} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


