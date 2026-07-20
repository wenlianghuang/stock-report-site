type SpeechRecognitionErrorEvent = Event & { error: string };

type SpeechRecognitionResultItem = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: SpeechRecognitionResultItem;
};

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
};

type BrowserSpeechRecognition = EventTarget & {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechSupported(): boolean {
  return getSpeechRecognition() !== null;
}

export type BrowserSpeechSession = {
  stop: () => void;
  result: Promise<string>;
};

/** Start browser speech recognition and stop manually via stop(). */
export function startBrowserSpeech(
  timeoutMs = 30000,
  onInterim?: (text: string) => void,
): BrowserSpeechSession {
  const Ctor = getSpeechRecognition();
  if (!Ctor) {
    return {
      stop: () => {},
      result: Promise.reject(
        new Error("此瀏覽器不支援語音辨識（請用 Chrome / Edge / Safari）"),
      ),
    };
  }

  const recognition = new Ctor();
  recognition.lang = "zh-TW";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let settled = false;
  let stoppedByUser = false;
  let timedOut = false;
  let finalText = "";
  let latestInterim = "";

  const result = new Promise<string>((resolve, reject) => {
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    const timer = window.setTimeout(() => {
      timedOut = true;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      const merged = `${finalText} ${latestInterim}`.trim();
      if (merged) {
        finish(() => resolve(merged));
      } else {
        finish(() => reject(new Error("語音辨識逾時，請再試一次")));
      }
    }, timeoutMs);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Rebuild from scratch each time. event.results is cumulative;
      // appending would repeat older finals (e.g. "富採85000" × N).
      let rebuiltFinal = "";
      let rebuiltInterim = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const part = event.results[i]?.[0]?.transcript ?? "";
        if (!part) continue;
        if (event.results[i]?.isFinal) {
          rebuiltFinal += part;
        } else {
          rebuiltInterim += part;
        }
      }
      finalText = rebuiltFinal.trim();
      latestInterim = rebuiltInterim.trim();
      onInterim?.(`${finalText} ${latestInterim}`.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error;
      if (code === "aborted" && stoppedByUser) {
        return;
      }
      const message =
        code === "not-allowed"
          ? "麥克風權限被拒絕，請在瀏覽器設定中允許"
          : code === "no-speech"
            ? "沒有聽到語音，請再試一次"
            : `語音辨識失敗（${code}）`;
      finish(() => reject(new Error(message)));
    };

    recognition.onend = () => {
      if (settled) return;
      const merged = `${finalText} ${latestInterim}`.trim();
      if (merged) {
        finish(() => resolve(merged));
        return;
      }
      if (timedOut) {
        finish(() => reject(new Error("語音辨識逾時，請再試一次")));
        return;
      }
      finish(() => reject(new Error("沒有聽到語音，請再試一次")));
    };

    try {
      recognition.start();
    } catch {
      finish(() => reject(new Error("無法啟動語音辨識")));
    }
  });

  return {
    stop: () => {
      stoppedByUser = true;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    },
    result,
  };
}
