"use client";

import { useEffect, useMemo, useReducer } from "react";

type AppStatus = "IDLE" | "UPLOADING" | "PROCESSING" | "SUCCESS" | "ERROR";
type Stage = "analyzing" | "generating" | "stitching" | "exporting";
type SubtitleMode = "auto" | "bilingual" | "off";
type StyleStrength = "low" | "medium" | "high";

type TaskResult = {
  videoUrl: string;
  downloadUrl: string;
};

type State = {
  status: AppStatus;
  projectId?: string;
  file?: File;
  videoUrl: string;
  outputLanguage: string;
  subtitleMode: SubtitleMode;
  styleStrength: StyleStrength;
  uploadProgress: number;
  stage: Stage;
  progress: number;
  result?: TaskResult;
  error?: string;
};

type Action =
  | { type: "SET_FILE"; file?: File }
  | { type: "SET_VIDEO_URL"; value: string }
  | { type: "SET_LANGUAGE"; value: string }
  | { type: "SET_SUBTITLE"; value: SubtitleMode }
  | { type: "SET_STYLE"; value: StyleStrength }
  | { type: "SUBMIT_UPLOAD" }
  | { type: "UPLOAD_PROGRESS"; progress: number }
  | { type: "TASK_CREATED"; projectId: string }
  | { type: "POLL_UPDATE"; stage: Stage; progress: number }
  | { type: "TASK_SUCCESS"; result: TaskResult }
  | { type: "TASK_ERROR"; error: string }
  | { type: "BACK_TO_IDLE" }
  | { type: "RESET_ERROR" };

const initialState: State = {
  status: "IDLE",
  videoUrl: "",
  outputLanguage: "zh-CN",
  subtitleMode: "auto",
  styleStrength: "medium",
  uploadProgress: 0,
  stage: "analyzing",
  progress: 0
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_FILE":
      return { ...state, file: action.file };
    case "SET_VIDEO_URL":
      return { ...state, videoUrl: action.value };
    case "SET_LANGUAGE":
      return { ...state, outputLanguage: action.value };
    case "SET_SUBTITLE":
      return { ...state, subtitleMode: action.value };
    case "SET_STYLE":
      return { ...state, styleStrength: action.value };
    case "SUBMIT_UPLOAD":
      return { ...state, status: "UPLOADING", uploadProgress: 0, error: undefined };
    case "UPLOAD_PROGRESS":
      return { ...state, uploadProgress: action.progress };
    case "TASK_CREATED":
      return {
        ...state,
        projectId: action.projectId,
        status: "PROCESSING",
        stage: "analyzing",
        progress: 8,
        error: undefined
      };
    case "POLL_UPDATE":
      return { ...state, stage: action.stage, progress: action.progress };
    case "TASK_SUCCESS":
      return { ...state, status: "SUCCESS", result: action.result, progress: 100 };
    case "TASK_ERROR":
      return { ...state, status: "ERROR", error: action.error };
    case "BACK_TO_IDLE":
      return { ...state, status: "IDLE", error: undefined, result: undefined, progress: 0 };
    case "RESET_ERROR":
      return { ...state, status: "IDLE", error: undefined };
    default:
      return state;
  }
}

const stageMap: Array<{ key: Stage; label: string }> = [
  { key: "analyzing", label: "分析素材" },
  { key: "generating", label: "生成复刻" },
  { key: "stitching", label: "智能拼接" },
  { key: "exporting", label: "导出成片" }
];

const stageText: Record<Stage, string> = {
  analyzing: "正在分析视频…",
  generating: "正在生成复刻视频…",
  stitching: "正在拼接画面与音频…",
  exporting: "正在导出成片…"
};

function isValidUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function fakeUpload(file: File, onProgress: (value: number) => void): Promise<void> {
  return new Promise((resolve) => {
    let p = 0;
    const timer = setInterval(() => {
      p = Math.min(100, p + Math.floor(Math.random() * 22) + 12);
      onProgress(p);
      if (p >= 100) {
        clearInterval(timer);
        setTimeout(resolve, 250);
      }
    }, 220);
  });
}

function fakeCreateProject(): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(`proj_${Math.random().toString(36).slice(2, 10)}`), 350);
  });
}

export default function HomePage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const canSubmit = useMemo(() => {
    const hasInput = Boolean(state.file) || isValidUrl(state.videoUrl);
    return hasInput && state.status === "IDLE";
  }, [state.file, state.videoUrl, state.status]);

  useEffect(() => {
    if (state.projectId) {
      localStorage.setItem("copyvideo_project_id", state.projectId);
    }
  }, [state.projectId]);

  useEffect(() => {
    if (state.status !== "PROCESSING") return;

    let cancelled = false;
    const ticks = [
      { stage: "analyzing" as Stage, progress: 18 },
      { stage: "generating" as Stage, progress: 45 },
      { stage: "stitching" as Stage, progress: 72 },
      { stage: "exporting" as Stage, progress: 94 }
    ];

    let idx = 0;
    const timer = setInterval(() => {
      if (cancelled) return;
      if (idx < ticks.length) {
        dispatch({ type: "POLL_UPDATE", stage: ticks[idx].stage, progress: ticks[idx].progress });
        idx += 1;
        return;
      }
      clearInterval(timer);
      if (Math.random() < 0.12) {
        dispatch({ type: "TASK_ERROR", error: "生成失败，请重试。" });
        return;
      }
      const result: TaskResult = {
        videoUrl:
          "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        downloadUrl:
          "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
      };
      dispatch({ type: "TASK_SUCCESS", result });
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [state.status]);

  async function handleGenerate() {
    if (!canSubmit) return;

    if (state.file) {
      dispatch({ type: "SUBMIT_UPLOAD" });
      await fakeUpload(state.file, (progress) => dispatch({ type: "UPLOAD_PROGRESS", progress }));
    }

    const projectId = await fakeCreateProject();
    dispatch({ type: "TASK_CREATED", projectId });
  }

  async function handleRegenerate(languageOnly = false) {
    if (languageOnly) {
      // 保留当前语言选择，可在真实接口中调用 regenerate-with-language
    }
    const projectId = await fakeCreateProject();
    dispatch({ type: "TASK_CREATED", projectId });
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="h-16 border-b border-black/5">
        <div className="mx-auto flex h-full w-full max-w-[960px] items-center justify-between px-6 md:px-10">
          <div className="text-sm font-semibold tracking-tight">CopyVideo</div>
          <button className="rounded-lg border border-black/10 px-3 py-1.5 text-xs text-black/70 hover:bg-black/5">
            用户
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[960px] flex-1 items-center justify-center px-6 py-10 md:px-10">
        <section className="w-full max-w-[760px]">
          {(state.status === "IDLE" || state.status === "UPLOADING") && (
            <div className="space-y-8">
              <div className="space-y-3 text-center">
                <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">复刻任意视频</h1>
                <p className="text-base text-black/60">上传参考视频或粘贴链接，几分钟生成完整复刻成片</p>
              </div>

              <div className="rounded-2xl border border-black/10 p-4 md:p-5">
                <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-black/15 bg-black/[0.02] text-center hover:bg-black/[0.03]">
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => dispatch({ type: "SET_FILE", file: e.target.files?.[0] })}
                  />
                  <p className="text-sm font-medium">拖拽上传视频 / 点击选择文件</p>
                  <p className="mt-1 text-xs text-black/45">支持 MP4 / MOV / WEBM，最大 500MB</p>
                  {state.file && <p className="mt-2 text-xs text-indigo-600">已选：{state.file.name}</p>}
                </label>

                <div className="mt-4">
                  <label className="mb-1.5 block text-xs text-black/50">或粘贴视频链接</label>
                  <input
                    value={state.videoUrl}
                    onChange={(e) => dispatch({ type: "SET_VIDEO_URL", value: e.target.value })}
                    placeholder="https://example.com/video"
                    className="w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none ring-indigo-500/40 transition focus:ring"
                  />
                  {state.videoUrl && !isValidUrl(state.videoUrl) && (
                    <p className="mt-1 text-xs text-red-500">请输入合法 https 视频链接</p>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-black/50">输出语言</label>
                    <select
                      value={state.outputLanguage}
                      onChange={(e) => dispatch({ type: "SET_LANGUAGE", value: e.target.value })}
                      className="w-full rounded-xl border border-black/15 px-3 py-2.5 text-sm outline-none ring-indigo-500/40 focus:ring"
                    >
                      <option value="zh-CN">简体中文</option>
                      <option value="en-US">English</option>
                      <option value="ja-JP">日本語</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-black/50">字幕模式</label>
                    <div className="flex rounded-xl border border-black/15 p-1 text-xs">
                      {[
                        ["auto", "自动"],
                        ["bilingual", "双语"],
                        ["off", "关闭"]
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => dispatch({ type: "SET_SUBTITLE", value: value as SubtitleMode })}
                          className={`flex-1 rounded-lg px-2 py-1.5 ${
                            state.subtitleMode === value ? "bg-black text-white" : "text-black/70"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-black/50">风格强度</label>
                    <div className="flex rounded-xl border border-black/15 p-1 text-xs">
                      {[
                        ["low", "保真"],
                        ["medium", "平衡"],
                        ["high", "创新"]
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          onClick={() => dispatch({ type: "SET_STYLE", value: value as StyleStrength })}
                          className={`flex-1 rounded-lg px-2 py-1.5 ${
                            state.styleStrength === value ? "bg-black text-white" : "text-black/70"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!canSubmit || state.status === "UPLOADING"}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-6 text-sm font-medium text-white shadow-[0_8px_24px_rgba(79,70,229,0.28)] transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {state.status === "UPLOADING" ? `上传中 ${state.uploadProgress}%` : "一键复刻"}
                </button>
              </div>
            </div>
          )}

          {state.status === "PROCESSING" && (
            <div className="mx-auto max-w-[640px] space-y-8 rounded-2xl border border-black/10 p-8 text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-black/15 border-t-indigo-600" />
              <div className="space-y-2">
                <p className="text-xl font-medium tracking-tight">{stageText[state.stage]}</p>
                <p className="text-sm text-black/50">你可以关闭页面，任务会在云端继续。</p>
              </div>

              <div className="space-y-3 text-left">
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                  <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${state.progress}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                  {stageMap.map((item) => {
                    const active = stageMap.findIndex((it) => it.key === state.stage) >= stageMap.findIndex((it) => it.key === item.key);
                    return (
                      <div key={item.key} className={`rounded-lg border px-2 py-1.5 text-center ${active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-black/10 text-black/40"}`}>
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {state.status === "ERROR" && (
            <div className="mx-auto max-w-[640px] space-y-5 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm text-red-700">{state.error ?? "本次生成失败，请重试。"}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => handleRegenerate(false)}
                  className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white"
                >
                  重新生成
                </button>
                <button
                  onClick={() => dispatch({ type: "RESET_ERROR" })}
                  className="h-11 rounded-xl border border-black/15 px-5 text-sm"
                >
                  返回修改参数
                </button>
              </div>
            </div>
          )}

          {state.status === "SUCCESS" && state.result && (
            <div className="space-y-5 rounded-2xl border border-black/10 p-5 md:p-6">
              <video src={state.result.videoUrl} controls className="aspect-video w-full rounded-xl bg-black" />
              <div className="flex flex-wrap gap-3">
                <a
                  href={state.result.downloadUrl}
                  download
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-6 text-sm font-medium text-white shadow-[0_8px_24px_rgba(79,70,229,0.28)]"
                >
                  下载视频
                </a>
                <button
                  onClick={() => handleRegenerate(false)}
                  className="h-12 rounded-xl border border-black/15 px-5 text-sm"
                >
                  再生成一次
                </button>
                <button
                  onClick={() => handleRegenerate(true)}
                  className="h-12 rounded-xl bg-black/5 px-5 text-sm"
                >
                  更换语言后重新生成
                </button>
                <button
                  onClick={() => dispatch({ type: "BACK_TO_IDLE" })}
                  className="h-12 rounded-xl bg-black/5 px-5 text-sm"
                >
                  新任务
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-black/5">
        <div className="mx-auto w-full max-w-[960px] px-6 py-4 text-xs text-black/45 md:px-10">
          上传内容仅用于本次生成任务，请确保拥有素材使用权。
        </div>
      </footer>
    </div>
  );
}
