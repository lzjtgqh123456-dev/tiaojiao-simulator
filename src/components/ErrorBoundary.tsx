import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleEmergencyReset = async () => {
    try {
      if (typeof window !== 'undefined') {
        (window as any).__isWipingAllStorage = true;
      }
      await fetch('/api/storage/clear', { method: 'POST' }).catch(() => {});
      localStorage.clear();
      sessionStorage.clear();
      if (typeof indexedDB !== 'undefined') {
        try {
          indexedDB.deleteDatabase('UltraPortraitDB');
          indexedDB.deleteDatabase('UltraSaveSlotsDB');
          indexedDB.deleteDatabase('UltraModelDB');
        } catch {}
      }
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-zinc-900/90 border border-red-500/40 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="text-lg font-bold text-center text-red-300 mb-2">系统运行保护 · 页面异常已拦截</h1>
            <p className="text-xs text-zinc-400 text-center leading-relaxed mb-4">
              检测到界面渲染异常，已自动保护核心数据。您可以尝试刷新恢复，或执行纯净重置修复受损的缓存数据。
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 rounded-xl bg-black/60 border border-zinc-800 text-[11px] font-mono text-rose-300/90 max-h-60 overflow-y-auto select-text">
                <div className="font-bold break-all mb-1">{this.state.error.toString()}</div>
                {this.state.error.stack && (
                  <pre className="whitespace-pre-wrap break-all opacity-80">{this.state.error.stack}</pre>
                )}
                {this.state.errorInfo?.componentStack && (
                  <pre className="whitespace-pre-wrap break-all opacity-60">{this.state.errorInfo.componentStack}</pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-blue-900/50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>重新载入系统</span>
              </button>
              <button
                onClick={this.handleEmergencyReset}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-red-950 text-zinc-300 hover:text-red-200 border border-zinc-700 hover:border-red-600 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>一键纯净重置</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
