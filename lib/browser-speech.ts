type SpeechRecognitionErrorEvent = Event & { error: string };

type SpeechRecognitionResultList = {
  length: number;
  [index: number]: { 0?: { transcript?: string } };
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

/** Listen once via Web Speech API (zh-TW). Rejects on error or empty result. */
export function listenOnce(timeoutMs = 15000): Promise<string> {
  const Ctor = getSpeechRecognition();
  if (!Ctor) {
    return Promise.reject(new Error("此瀏覽器不支援語音辨識（請用 Chrome / Edge / Safari）"));
  }

  return new Promise((resolve, reject) => {
    const recognition = new Ctor();
    recognition.lang = "zh-TW";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let settled = false;
    let gotResult = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    const timer = window.setTimeout(() => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      finish(() => reject(new Error("語音辨識逾時，請再試一次")));
    }, timeoutMs);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      gotResult = true;
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join("")
        .trim();
      if (!transcript) {
        finish(() => reject(new Error("沒有辨識到內容，請再試一次")));
        return;
      }
      finish(() => resolve(transcript));
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = event.error;
      if (code === "aborted") return;
      const message =
        code === "not-allowed"
          ? "麥克風權限被拒絕，請在瀏覽器設定中允許"
          : code === "no-speech"
            ? "沒有聽到語音，請再試一次"
            : `語音辨識失敗（${code}）`;
      finish(() => reject(new Error(message)));
    };

    recognition.onend = () => {
      if (!gotResult) {
        finish(() => reject(new Error("沒有聽到語音，請再試一次")));
      }
    };

    try {
      recognition.start();
    } catch {
      finish(() => reject(new Error("無法啟動語音辨識")));
    }
  });
}
