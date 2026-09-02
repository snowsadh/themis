import { useState, useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { api } from '../utils/api';

const JUDGE_OPENINGS = [
  "This Court takes up the matter of {CASE}. Proceed, Counsel.",
  "The Bench has perused the submissions. We shall now hear oral arguments in {CASE}.",
  "Order. This Court is assembled to adjudicate upon {CASE}. Petitioner's Counsel, you may begin.",
];

export function useJudge() {
  const {
    selectedCase,
    matchMode,
    addTranscript,
    setJudgeMessage,
    clearJudge,
    updateScores,
    beginJudgePhase,
    resumeSameSpeakerWithRetry,
    advanceToOtherSpeaker,
  } = useGameStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const busy = useRef(false);
  const synthRef = useRef(null);
  const voicesRef = useRef([]);

  useEffect(() => {
    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      voicesRef.current = synthRef.current.getVoices();
      synthRef.current.onvoiceschanged = () => {
        voicesRef.current = synthRef.current.getVoices();
      };
      console.log("Speech synthesis initialized");
    } else {
      console.error("Speech synthesis not supported in this browser");
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const pickJudgeVoice = useCallback(() => {
    const voices = voicesRef.current || [];
    if (!voices.length) return null;
    return voices.find(v => v.lang?.toLowerCase().startsWith('en-in'))
      || voices.find(v => v.lang?.toLowerCase().startsWith('en'))
      || voices[0];
  }, []);

  const speak = useCallback((text, options = {}) => {
    const { interrupt = false } = options;
    if (!synthRef.current) {
      console.error("Speech synthesis not available");
      return Promise.resolve();
    }

    if (typeof synthRef.current.resume === 'function') {
      synthRef.current.resume();
    }
    synthRef.current.cancel();

    return new Promise((resolve) => {
      const clippedText = interrupt
        ? text.split(/[.?!]/).filter(Boolean)[0] || text
        : text;
      const utterance = new SpeechSynthesisUtterance(clippedText);
      const selectedVoice = pickJudgeVoice();
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.lang = selectedVoice?.lang || 'en-IN';
      utterance.rate = interrupt ? 1.1 : 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      utterance.onend = done;
      utterance.onerror = () => done();

      synthRef.current.speak(utterance);
      setTimeout(done, interrupt ? 1800 : 7000);
    });
  }, [pickJudgeVoice]);

  const buildBotArgument = useCallback((side, caseData, history) => {
    const caseTitle = caseData?.title || 'the selected matter';
    const issue = caseData?.issues?.[0] || 'the core issue before the Court';
    const precedent = caseData?.precedents?.[0] || 'the relevant precedent';
    const lastJudgeLine = [...(history || [])].reverse().find((entry) => entry.type === 'judge')?.text || '';
    const opener = side === 'petitioner'
      ? 'The petitioner submits that the impugned action fails the constitutional test and must be struck down.'
      : 'The respondent submits that the challenged action is justified and supported by law.';
    const followUp = side === 'petitioner'
      ? `This Court should read ${precedent} as confirming that ${issue.toLowerCase()}.`
      : `The petitioner is overstating the defect; ${caseTitle} turns on context, balance, and statutory purpose.`;
    const closing = lastJudgeLine
      ? 'In light of the Bench’s concern, the proper answer remains focused and narrow.'
      : 'The better view is that the record supports our position.';

    return [opener, followUp, closing].join(' ');
  }, []);

  const processArgument = useCallback(async (text, side) => {
    if (!text.trim() || busy.current) return;
    busy.current = true;
    setIsProcessing(true);
    useGameStore.getState().setError("");

    const runTurn = async (turnText, turnSide, { isBot = false } = {}) => {
      beginJudgePhase();

      let judgeResponse = null;
      try {
        const state = useGameStore.getState();
        const selectedCaseData = state.selectedCase;
        const sessionId = state.sessionId;

        const history = state.transcript.filter(t => ["judge", "petitioner", "respondent"].includes(t.type)).slice(-60).map(t => ({
          role: t.type === 'judge' ? 'Judge' : (t.type === 'petitioner' ? 'Petitioner' : 'Respondent'),
          argument: t.text
        }));

        const roleName = turnSide === 'petitioner' ? 'Petitioner' : 'Respondent';

        const { response } = await api("/argue", {
          role: roleName, text: turnText, history,
          selectedCase: selectedCaseData, options: state.options,
        });
        if (useGameStore.getState().sessionId !== sessionId) return null;
        judgeResponse = response;

        const {
          feedback = "The Court acknowledges your submission.",
          logic_score = 5,
          clarity_score = 5,
          confidence_score = 5,
          interrupt = false,
          evidence = [],
          reasoning_breakdown = null,
        } = judgeResponse;

        const scores = {
          logic: logic_score,
          clarity: clarity_score,
          confidence: confidence_score,
          feedback: feedback,
          evidence,
          reasoning_breakdown,
        };

        const { retryCountBySpeaker } = useGameStore.getState();
        const nextAttempt = Math.min((retryCountBySpeaker?.[turnSide] || 0) + 1, 2);
        const interruptContext = interrupt
          ? { speaker: turnSide, attempt: nextAttempt, max: 2 }
          : null;

        addTranscript({ type: turnSide, text: turnText, bot: isBot });
        if (!isBot) useGameStore.getState().setDraft(turnSide, "");
        updateScores(turnSide, scores);
        setJudgeMessage(feedback, interrupt, interruptContext);
        await speak(feedback, { interrupt });
        addTranscript({ type: 'judge', text: feedback, scores });
      } catch (error) {
        const state = useGameStore.getState();
        state.setError(error.message);
        state.restoreTurn(turnSide);
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, judgeResponse?.interrupt ? 120 : 220));
      clearJudge();

      const { retryCountBySpeaker: retries } = useGameStore.getState();
      const isInterrupt = !!judgeResponse?.interrupt;
      const currentRetries = retries?.[turnSide] || 0;

      if (isInterrupt && currentRetries < 2 && !isBot) {
        resumeSameSpeakerWithRetry(turnSide);
      } else {
        advanceToOtherSpeaker(turnSide);
      }

      return judgeResponse;
    };

    try {
      const humanResponse = await runTurn(text, side);

      if (humanResponse && matchMode === '1VBOT' && side === 'petitioner' && !humanResponse.interrupt) {
        const state = useGameStore.getState();
        const botText = buildBotArgument('respondent', state.selectedCase, state.transcript);
        await new Promise((resolve) => setTimeout(resolve, 900));
        await runTurn(botText, 'respondent', { isBot: true });
      }
    } finally {
      busy.current = false;
      setIsProcessing(false);
    }
  }, [
    isProcessing,
    addTranscript,
    setJudgeMessage,
    clearJudge,
    updateScores,
    beginJudgePhase,
    resumeSameSpeakerWithRetry,
    advanceToOtherSpeaker,
    speak,
    buildBotArgument,
    matchMode,
  ]);

  const getOpeningStatement = useCallback(() => {
    if (!selectedCase) return "Order! This Court is now in session.";
    const template = JUDGE_OPENINGS[Math.floor(Math.random() * JUDGE_OPENINGS.length)];
    return template.replace('{CASE}', selectedCase.title);
  }, [selectedCase]);

  return { processArgument, isProcessing, getOpeningStatement };
}
