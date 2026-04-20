```react
import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Settings2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  RotateCcw,
  BrainCircuit,
  GraduationCap,
  ListOrdered,
  FileText,
  XCircle,
  ArrowLeft,
  FileUp,
  Key,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Loader2
} from 'lucide-react';

// --- 관리자 설정 구역 ---
const MASTER_ACCESS_CODE = "ghlee"; 
const MODEL_NAME = "gemini-2.5-flash-preview-09-2025";
// -----------------------

export default function App() {
  // 권한 상태 관리
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [accessInput, setAccessInput] = useState('');
  const [accessError, setAccessError] = useState(false);

  // 앱 로직 상태 관리
  const [view, setView] = useState('input');
  const [lectureNotes, setLectureNotes] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [error, setError] = useState(null);
  
  // API 키 상태 관리
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  
  // UI 상태 관리
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const fileInputRef = useRef(null);

  // 초기화: 저장된 인증 및 API 키 불러오기
  useEffect(() => {
    const savedAuth = localStorage.getItem('app_authorized');
    if (savedAuth === 'true') setIsAuthorized(true);

    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);

    // PDF.js 라이브러리 동적 로드
    if (!window.pdfjsLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      };
      document.head.appendChild(script);
    }
  }, []);

  // 액세스 코드 확인 로직
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

  const handleLogout = () => {
    setIsAuthorized(false);
    localStorage.removeItem('app_authorized');
  };

  // API 키 저장 로직
  const handleSaveKey = (e) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('gemini_api_key', newKey);
  };

  // PDF 텍스트 추출 로직
  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      setError("올바른 PDF 파일을 선택해주세요.");
      return;
    }
    if (!window.pdfjsLib) {
      setError("PDF 라이브러리를 로드하는 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    
    setIsPdfProcessing(true);
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);
          const pdf = await window.pdfjsLib.getDocument(typedarray).promise;
          let fullText = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(" ") + "\n";
          }
          setLectureNotes(fullText);
        } catch (pdfErr) {
          setError("PDF 내용을 읽는 중 오류가 발생했습니다.");
        } finally {
          setIsPdfProcessing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError("파일 처리 중 오류가 발생했습니다.");
      setIsPdfProcessing(false);
    }
  };

  // 지수 백오프를 적용한 API 호출 함수
  async function fetchWithRetry(url, options, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        if (response.status === 429 || response.status >= 500) {
          const delay = Math.pow(2, i) * 1000;
          await new Promise(res => setTimeout(res, delay));
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (err) {
        if (i === maxRetries - 1) throw err;
        const delay = Math.pow(2, i) * 1000;
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  // Gemini API 호출 로직
  async function fetchQuestions(prompt, count, diff) {
    const systemPrompt = `당신은 교육 전문가입니다. 제공된 강의록을 바탕으로 ${count}개의 객관식 문제를 만드세요.
    난이도: ${diff}. 
    중요 지침: '하'와 '중' 난이도의 경우, 반드시 강의록에 있는 용어와 표현을 그대로 사용하여 문제를 구성하세요. 외부 동의어를 사용하지 마세요.
    출력 형식: 반드시 JSON 배열 형식으로만 응답하세요. { "question": "질문", "options": ["보기1", "보기2", "보기3", "보기4"], "answer": 정답인덱스(0-3), "explanation": "해설" }`;
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: `Lecture Notes: ${prompt}` }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { 
        responseMimeType: "application/json",
        temperature: 0.7
      }
    };

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("INVALID_RESPONSE");
    return JSON.parse(text);
  }

  const handleGenerate = async () => {
    if (!apiKey) { setError("API 키를 입력해주세요."); return; }
    if (!lectureNotes.trim() || lectureNotes.length < 30) { setError("내용이 너무 짧습니다. 최소 30자 이상 입력해주세요."); return; }
    setError(null);
    setView('generating');
    try {
      const data = await fetchQuestions(lectureNotes, questionCount, difficulty);
      setQuestions(Array.isArray(data) ? data : [data]);
      setUserAnswers({});
      setCurrentQuestionIndex(0);
      setView('quiz');
    } catch (err) {
      console.error(err);
      setError("문제 생성 중 오류가 발생했습니다. API 키의 유효성과 네트워크 상태를 확인해주세요.");
      setView('input');
    }
  };

  const diffLabels = {
    Low: { label: '하 (기초)', color: 'bg-green-100 text-green-700' },
    Medium: { label: '중 (응용)', color: 'bg-yellow-100 text-yellow-700' },
    High: { label: '상 (심화)', color: 'bg-red-100 text-red-700' }
  };

  // --- Views ---

  // 권한 인증 화면
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center space-y-8 animate-in fade-in zoom-in duration-300">
          <div className="mx-auto w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center text-blue-600">
            <Lock size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900">액세스 제한</h1>
            <p className="text-slate-500 font-medium text-sm leading-relaxed">
              이 서비스는 허가된 사용자만 이용할 수 있습니다.<br/>관리자가 부여한 액세스 코드를 입력하세요.
            </p>
          </div>
          <form onSubmit={handleAuthorize} className="space-y-4">
            <input
              type="password"
              placeholder="액세스 코드 입력"
              className={`w-full p-4 bg-slate-50 border-2 rounded-2xl text-center font-bold tracking-widest outline-none transition-all ${
                accessError ? 'border-red-500 ring-4 ring-red-50' : 'border-slate-100 focus:border-blue-500'
              }`}
              value={accessInput}
              onChange={(e) => setAccessInput(e.target.value)}
            />
            {accessError && <p className="text-red-500 text-xs font-bold">코드가 일치하지 않습니다.</p>}
            <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95">
              <Unlock size={20} /> 권한 확인
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 메인 입력 화면
  const InputView = () => (
    <div className="max-w-4xl w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-end">
        <button onClick={handleLogout} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors">
          <Lock size={14} /> 로그아웃
        </button>
      </div>

      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-4">
          <BrainCircuit className="text-blue-600 w-10 h-10 sm:w-12 sm:h-12 shrink-0" />
          <span>AI 기반 문제 생성기</span>
        </h1>
        <p className="text-slate-500 text-sm sm:text-base md:text-lg font-medium">강의록의 핵심 내용을 분석하여 맞춤형 퀴즈를 생성합니다.</p>
      </div>

      {/* API 키 설정 영역 */}
      <div className="bg-blue-600 rounded-3xl shadow-xl p-6 text-white space-y-4">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 font-bold text-sm">
            <Key size={18} /> Gemini API 키 설정
          </label>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors font-medium">
            키 발급받기
          </a>
        </div>
        <div className="relative">
          <input
            type={showKey ? "text" : "password"}
            className="w-full bg-white/10 border border-white/20 rounded-2xl py-3 px-5 pr-12 outline-none focus:ring-2 focus:ring-white/50 transition-all text-sm font-mono"
            placeholder="Gemini API 키를 입력하세요..."
            value={apiKey}
            onChange={handleSaveKey}
          />
          <button onClick={() => setShowKey(!showKey)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
            {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-6 md:p-10 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-base font-bold text-slate-800">
              <BookOpen size={20} className="text-blue-500" /> 강의 내용
            </label>
            <div className="flex gap-2">
              <input type="file" accept=".pdf" className="hidden" ref={fileInputRef} onChange={handlePdfUpload} />
              <button 
                onClick={() => fileInputRef.current.click()}
                disabled={isPdfProcessing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors border border-blue-100 shadow-sm disabled:opacity-50"
              >
                {isPdfProcessing ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
                {isPdfProcessing ? "처리 중..." : "PDF 업로드"}
              </button>
            </div>
          </div>
          <textarea
            className="w-full h-72 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none text-slate-700 leading-relaxed resize-none text-sm md:text-base font-sans"
            placeholder="강의 내용을 이곳에 직접 붙여넣거나 위의 PDF 업로드 버튼을 사용하세요..."
            value={lectureNotes}
            onChange={(e) => setLectureNotes(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">난이도 선택</label>
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              {['Low', 'Medium', 'High'].map((lv) => (
                <button
                  key={lv}
                  onClick={() => setDifficulty(lv)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${
                    difficulty === lv ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400'
                  }`}
                >
                  {diffLabels[lv].label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-800 flex items-center gap-2">문제 수 설정</label>
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              {[5, 10, 20, 30].map((num) => (
                <button
                  key={num}
                  onClick={() => setQuestionCount(num)}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all ${
                    questionCount === num ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-400'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleGenerate}
              className="w-full h-[58px] bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-blue-200 transition-all hover:-translate-y-1 active:scale-[0.98]"
            >
              <Sparkles size={20} /> 문제 생성하기
            </button>
          </div>
        </div>
        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </div>
    </div>
  );

  const GeneratingView = () => (
    <div className="flex flex-col items-center justify-center space-y-8 min-h-[60vh]">
      <div className="relative">
        <div className="w-24 h-24 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
        <BrainCircuit className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600 w-10 h-10" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-800 animate-pulse">문제를 생성하는 중입니다</h2>
        <p className="text-slate-500 font-medium">강의 내용을 분석하여 고품질의 문제를 만들고 있습니다...</p>
      </div>
    </div>
  );

  const QuizView = () => {
    const q = questions[currentQuestionIndex];
    if (!q) return null;

    return (
      <div className="max-w-3xl w-full space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between px-2 text-sm font-bold text-slate-500 uppercase tracking-widest">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${difficulty === 'Low' ? 'bg-green-500' : difficulty === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
            {diffLabels[difficulty].label}
          </span>
          <span>{currentQuestionIndex + 1} / {questions.length}</span>
        </div>
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 md:p-12 space-y-10">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-800 leading-snug">{q.question}</h2>
          <div className="space-y-4">
            {q.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => setUserAnswers({ ...userAnswers, [currentQuestionIndex]: idx })}
                className={`w-full text-left p-6 rounded-2xl border-2 transition-all flex items-center gap-5 group ${
                  userAnswers[currentQuestionIndex] === idx 
                    ? 'border-blue-500 bg-blue-50 text-blue-800 ring-4 ring-blue-50 shadow-inner' 
                    : 'border-slate-100 text-slate-600 hover:border-blue-200 hover:bg-slate-50'
                }`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black transition-colors ${
                  userAnswers[currentQuestionIndex] === idx 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="font-bold text-lg">{opt}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end pt-6 border-t border-slate-100">
            <button
              onClick={() => {
                if (currentQuestionIndex < questions.length - 1) setCurrentQuestionIndex(prev => prev + 1);
                else setView('result');
              }}
              disabled={userAnswers[currentQuestionIndex] === undefined}
              className="px-12 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black flex items-center gap-2 disabled:opacity-30 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {currentQuestionIndex === questions.length - 1 ? '최종 결과 보기' : '다음 문제'} <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ResultView = () => {
    const score = questions.reduce((acc, q, idx) => acc + (userAnswers[idx] === q.answer ? 1 : 0), 0);
    const wrongQs = questions.filter((q, idx) => userAnswers[idx] !== q.answer);
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <div className="max-w-4xl w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 p-10 md:p-16 overflow-hidden">
          <div className="inline-flex p-5 bg-blue-50 text-blue-600 rounded-3xl mb-8 animate-bounce">
            <GraduationCap size={64} />
          </div>
          <h2 className="text-4xl font-black mb-4 text-slate-900">학습 테스트 종료</h2>
          <div className="relative inline-block mb-10">
            <div className="text-8xl font-black text-blue-600 tracking-tighter">
              {score} <span className="text-3xl text-slate-300">/ {questions.length}</span>
            </div>
            <div className="absolute -right-12 top-0 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold">
              {percentage}%
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setView('review')} 
              disabled={wrongQs.length === 0} 
              className="py-6 bg-red-50 text-red-600 rounded-[2rem] font-black text-xl flex flex-col items-center gap-2 border-2 border-red-100 disabled:opacity-50 transition-all hover:bg-red-100 shadow-sm"
            >
              <FileText size={32} /> 오답 복기 ({wrongQs.length})
            </button>
            <button 
              onClick={() => setView('input')} 
              className="py-6 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-xl flex flex-col items-center gap-2 transition-all hover:shadow-xl"
            >
              <RotateCcw size={32} /> 다시 학습하기
            </button>
          </div>
        </div>
      </div>
    );
  };

  const ReviewView = () => {
    const wrongQs = questions.filter((q, idx) => userAnswers[idx] !== q.answer);
    return (
      <div className="max-w-4xl w-full space-y-8 animate-in slide-in-from-right-8 duration-500">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setView('result')} 
            className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={20} /> 결과로 돌아가기
          </button>
          <h2 className="text-2xl font-black flex items-center gap-3 text-slate-800">
            <XCircle className="text-red-500" /> 오답 복기 노트
          </h2>
          <div className="w-20"></div>
        </div>
        <div className="space-y-6 pb-20">
          {wrongQs.map((q, idx) => {
            const originalIdx = questions.indexOf(q);
            return (
              <div key={idx} className="bg-white rounded-3xl shadow-lg border border-red-50 p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <span className="shrink-0 w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-black">
                    {originalIdx + 1}
                  </span>
                  <h3 className="text-xl font-bold pt-1 leading-snug text-slate-800">{q.question}</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:ml-14">
                  <div className="p-4 rounded-2xl bg-red-50 text-sm font-bold text-red-700 border border-red-100">
                    나의 답변: {q.options[userAnswers[originalIdx]] || "선택 안 함"}
                  </div>
                  <div className="p-4 rounded-2xl bg-green-50 text-sm font-bold text-green-700 border border-green-100">
                    정답: {q.options[q.answer]}
                  </div>
                </div>
                <div className="sm:ml-14 p-6 bg-slate-50 rounded-2xl border border-slate-100 relative">
                  <div className="absolute -top-3 left-6 px-2 bg-blue-600 text-white text-[10px] font-black uppercase rounded shadow-sm">AI Analysis</div>
                  <p className="text-slate-600 leading-relaxed font-medium pt-2 font-sans">{q.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 flex flex-col items-center justify-center p-4 md:p-12 overflow-x-hidden relative">
      {view === 'input' && <InputView />}
      {view === 'generating' && <GeneratingView />}
      {view === 'quiz' && <QuizView />}
      {view === 'result' && <ResultView />}
      {view === 'review' && <ReviewView />}
      
      {/* 배경 장식 요소 */}
      <div className="fixed -z-10 top-0 left-0 w-full h-full opacity-[0.04] pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-blue-600 rounded-full blur-[150px]"></div>
        <div className="absolute -bottom-40 -right-20 w-[800px] h-[800px] bg-indigo-600 rounded-full blur-[180px]"></div>
      </div>
    </div>
  );
}

```
