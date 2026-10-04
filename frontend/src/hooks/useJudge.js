import { useCallback, useEffect, useRef, useState } from "react";
import { GAME_PHASES, useGameStore } from "../store/gameStore";
import { api } from "../utils/api";

const historyFor = (state) =>
  state.transcript
    .filter((t) => ["judge", "petitioner", "respondent"].includes(t.type))
    .slice(-60)
    .map((t) => ({
      role: t.type[0].toUpperCase() + t.type.slice(1),
      argument: t.text,
      speaker: t.speaker || null,
      interrupt: !!t.interrupt,
    }));

export function useJudge() {
  const [isProcessing, setIsProcessing] = useState(false);
  const busy = useRef(false);
  const controller = useRef(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      window.speechSynthesis?.cancel();
    },
    [],
  );
  const cancelRequest = useCallback(() => {
    controller.current?.abort();
    const state = useGameStore.getState();
    state.restoreTurn(state.currentSpeaker);
    state.setError(
      "Request withdrawn. Your draft is unchanged. Submit again when you’re ready.",
    );
    setIsProcessing(false);
  }, []);
  const processArgument = useCallback(async (text, side, isBot = false) => {
    if (busy.current) return false;
    const initial = useGameStore.getState();
    if (
      initial.phase !== GAME_PHASES.COURTROOM ||
      initial.pendingRuling ||
      side !== initial.currentSpeaker
    )
      return false;
    if (!isBot && !text.trim()) return false;
    busy.current = true;
    setIsProcessing(true);
    const abort = new AbortController();
    controller.current = abort;
    const signal = abort.signal;
    const active = () =>
      !signal.aborted &&
      useGameStore.getState().sessionId === initial.sessionId;
    try {
      initial.beginJudgePhase();
      let turnText = text;
      if (isBot) {
        turnText =
          initial.pendingBot?.side === side
            ? initial.pendingBot.text
            : (
                await api(
                  "/counsel",
                  {
                    role: side === "petitioner" ? "Petitioner" : "Respondent",
                    selectedCase: initial.selectedCase,
                    history: historyFor(initial),
                    options: initial.options,
                  },
                  signal,
                )
              ).text;
        if (!active()) return false;
        useGameStore.setState({ pendingBot: { side, text: turnText } });
      }
      const { response } = await api(
        "/argue",
        {
          role: side === "petitioner" ? "Petitioner" : "Respondent",
          text: turnText,
          history: historyFor(initial),
          selectedCase: initial.selectedCase,
          options: initial.options,
        },
        signal,
      );
      if (!active()) return false;
      if (
        !response?.delta_scores ||
        typeof response.judge_response !== "string"
      )
        throw new Error(
          "The bench returned an incomplete ruling. Please retry; no score has been recorded.",
        );
      const current = useGameStore.getState();
      current.addTranscript({ type: side, text: turnText, bot: isBot });
      current.updateScores(side, response);
      current.addTranscript({
        type: "judge",
        text: response.judge_response,
        speaker: side,
        interrupt: !response.speaker_switch,
        evaluation: response,
      });
      current.setJudgeMessage(
        response.judge_response,
        !response.speaker_switch,
      );
      if (!isBot) current.setDraft(side, "");
      useGameStore.setState({
        pendingBot: null,
        pendingRuling: {
          side,
          interrupt: !response.speaker_switch,
          botArgument: isBot ? turnText : null,
        },
        turnState: "REVIEW",
      });
      if (current.voiceEnabled && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(
          new SpeechSynthesisUtterance(response.judge_response),
        );
      }
      return true;
    } catch (error) {
      if (active()) {
        const state = useGameStore.getState();
        state.setError(error.message);
        state.restoreTurn(side);
      }
      return false;
    } finally {
      busy.current = false;
      if (active()) setIsProcessing(false);
    }
  }, []);
  return { processArgument, isProcessing, cancelRequest };
}
