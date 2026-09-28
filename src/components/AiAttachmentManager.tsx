import React, { useState, useRef } from 'react';
import { AiAttachment } from '../types';
import {
  FileText, Image as ImageIcon, Upload, Plus, Trash2, Edit2, Eye,
  Check, Copy, Download, X, FileCode, CheckCircle2, AlertCircle,
  FileCheck, Sparkles, Sliders, ExternalLink, ZoomIn, FileSpreadsheet
} from 'lucide-react';
import { ultraAudio } from '../utils/audio';

interface AiAttachmentManagerProps {
  title: string;
  description?: string;
  category: 'general' | 'jailbreak' | 'worldview';
  attachments: AiAttachment[];
  onChange: (attachments: AiAttachment[]) => void;
  accentColor?: 'purple' | 'rose' | 'cyan' | 'amber';
  maxItems?: number;
}

export const AiAttachmentManager: React.FC<AiAttachmentManagerProps> = ({
  title,
  description,
  category,
  attachments = [],
  onChange,
  accentColor = 'purple',
  maxItems = 20,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'document' | 'image'>('all');
  const [previewAttachment, setPreviewAttachment] = useState<AiAttachment | null>(null);
  const [editingAttachment, setEditingAttachment] = useState<AiAttachment | null>(null);
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [isImageUrlModalOpen, setIsImageUrlModalOpen] = useState(false);

  // Form states for manual text paste
  const [textDocName, setTextDocName] = useState('');
  const [textDocContent, setTextDocContent] = useState('');
  const [textDocDesc, setTextDocDesc] = useState('');

  // Form states for manual image URL
  const [imgName, setImgName] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [imgDesc, setImgDesc] = useState('');

  // Copy toast state
  const [copySuccess, setCopySuccess] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const colorStyles = {
    purple: {
      border: 'border-purple-900/60',
      bg: 'bg-purple-950/20',
      accent: 'text-purple-400',
      badge: 'bg-purple-950/80 text-purple-300 border-purple-500/50',
      btn: 'bg-purple-600 hover:bg-purple-500 text-white',
      ring: 'focus:border-purple-500',
    },
    rose: {
      border: 'border-rose-900/60',
      bg: 'bg-rose-950/20',
      accent: 'text-rose-400',
      badge: 'bg-rose-950/80 text-rose-300 border-rose-500/50',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white',
      ring: 'focus:border-rose-500',
    },
    cyan: {
      border: 'border-cyan-900/60',
      bg: 'bg-cyan-950/20',
      accent: 'text-cyan-400',
      badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50',
      btn: 'bg-cyan-600 hover:bg-cyan-500 text-white',
      ring: 'focus:border-cyan-500',
    },
    amber: {
      border: 'border-amber-900/60',
      bg: 'bg-amber-950/20',
      accent: 'text-amber-400',
      badge: 'bg-amber-950/80 text-amber-300 border-amber-500/50',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white',
      ring: 'focus:border-amber-500',
    },
  }[accentColor];

  // Filter attachments
  const filteredAttachments = attachments.filter((att) => {
    if (activeFilter === 'document') return att.type === 'document';
    if (activeFilter === 'image') return att.type === 'image';
    return true;
  });

  const enabledCount = attachments.filter((a) => a.enabled).length;

  // Process files
  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    fileArray.forEach((file) => {
      const isImg = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);
      const reader = new FileReader();

      if (isImg) {
        reader.onload = (e) => {
          const base64Data = e.target?.result as string;
          if (!base64Data) return;

          // Helper to downscale if image is huge
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;
            const maxDim = 1200;

            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const compressed = canvas.toDataURL('image/jpeg', 0.85);
                addAttachment({
                  name: file.name,
                  type: 'image',
                  content: compressed,
                  mimeType: 'image/jpeg',
                  sizeBytes: Math.round(compressed.length * 0.75),
                  description: `上传图片 (${width}x${height})`,
                  enabled: true,
                });
                return;
              }
            }

            addAttachment({
              name: file.name,
              type: 'image',
              content: base64Data,
              mimeType: file.type || 'image/png',
              sizeBytes: file.size,
              description: `上传图片 (${img.width}x${img.height})`,
              enabled: true,
            });
          };
          img.src = base64Data;
        };
        reader.readAsDataURL(file);
      } else {
        // Document / Text / Markdown / JSON / CSV
        reader.onload = (e) => {
          const textContent = e.target?.result as string;
          if (typeof textContent !== 'string') return;

          addAttachment({
            name: file.name,
            type: 'document',
            content: textContent,
            mimeType: file.type || 'text/plain',
            sizeBytes: file.size,
            description: `上传文本/设定文档 (${textContent.length} 字符)`,
            enabled: true,
          });
        };
        reader.readAsText(file, 'utf-8');
      }
    });
  };

  const addAttachment = (item: Omit<AiAttachment, 'id' | 'createdAt' | 'category'>) => {
    const newAtt: AiAttachment = {
      ...item,
      id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      category,
      createdAt: new Date().toISOString(),
    };
    onChange([...attachments, newAtt]);
    ultraAudio.playUiClick();
  };

  const handleToggleAttachment = (id: string) => {
    ultraAudio.playUiClick();
    onChange(
      attachments.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const handleDeleteAttachment = (id: string) => {
    ultraAudio.playUiClick();
    onChange(attachments.filter((a) => a.id !== id));
    if (previewAttachment?.id === id) setPreviewAttachment(null);
    if (editingAttachment?.id === id) setEditingAttachment(null);
  };

  const handleSaveEdit = () => {
    if (!editingAttachment) return;
    onChange(
      attachments.map((a) => (a.id === editingAttachment.id ? editingAttachment : a))
    );
    setEditingAttachment(null);
    ultraAudio.playUiClick();
  };

  const handleCreateTextDoc = () => {
    if (!textDocName.trim() && !textDocContent.trim()) return;
    addAttachment({
      name: textDocName.trim() || `参考文档_${attachments.length + 1}.txt`,
      type: 'document',
      content: textDocContent,
      mimeType: 'text/plain',
      sizeBytes: new Blob([textDocContent]).size,
      description: textDocDesc.trim() || `手动添加参考资料 (${textDocContent.length} 字)`,
      enabled: true,
    });
    setTextDocName('');
    setTextDocContent('');
    setTextDocDesc('');
    setIsTextModalOpen(false);
  };

  const handleCreateImageUrl = () => {
    if (!imgUrl.trim()) return;
    addAttachment({
      name: imgName.trim() || `网络/粘贴图片_${attachments.length + 1}`,
      type: 'image',
      content: imgUrl.trim(),
      mimeType: 'image/jpeg',
      sizeBytes: imgUrl.length,
      description: imgDesc.trim() || '网络或粘贴图片参考',
      enabled: true,
    });
    setImgName('');
    setImgUrl('');
    setImgDesc('');
    setIsImageUrlModalOpen(false);
  };

  const handleCopyContent = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
    ultraAudio.playUiClick();
  };

  return (
    <div className={`space-y-2.5 p-3 rounded-xl border ${colorStyles.border} ${colorStyles.bg} text-xs font-mono`}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) processFiles(e.target.files);
          e.target.value = '';
        }}
        multiple
        accept=".txt,.md,.json,.csv,.xml,.yaml,.js,.ts,.html,.png,.jpg,.jpeg,.webp,.gif,.bmp"
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <FileCode className={`w-4 h-4 ${colorStyles.accent}`} />
          <span className="font-bold text-zinc-200">{title}</span>
          <span className={`px-1.5 py-0.2 rounded text-[10px] border ${colorStyles.badge}`}>
            已挂载 {attachments.length} 项 (已启用 {enabledCount})
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              fileInputRef.current?.click();
            }}
            className={`px-2.5 py-1 rounded ${colorStyles.btn} font-bold text-[11px] flex items-center space-x-1 transition-all cursor-pointer shadow-sm`}
            title="选择上传文档 (.txt, .md, .json) 或图片 (.png, .jpg, .webp)"
          >
            <Upload className="w-3 h-3" />
            <span>+ 上传文档/图片</span>
          </button>

          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setIsTextModalOpen(true);
            }}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] flex items-center space-x-1 cursor-pointer transition-all"
            title="手动新建或粘贴文本文档/规则/范例文本"
          >
            <FileText className="w-3 h-3 text-cyan-400" />
            <span>+ 粘贴文档</span>
          </button>

          <button
            type="button"
            onClick={() => {
              ultraAudio.playUiClick();
              setIsImageUrlModalOpen(true);
            }}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-[11px] flex items-center space-x-1 cursor-pointer transition-all"
            title="通过图片 URL 或 Base64 添加参考图片"
          >
            <ImageIcon className="w-3 h-3 text-amber-400" />
            <span>+ 图片链接</span>
          </button>
        </div>
      </div>

      {description && (
        <p className="text-[11px] text-zinc-400 leading-relaxed">
          {description}
        </p>
      )}

      {/* Drag and drop zone / Filter tabs */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border transition-all ${
          isDragging
            ? 'border-purple-400 bg-purple-950/40 p-3 text-center'
            : 'border-zinc-800 bg-black/40 p-2'
        }`}
      >
        {isDragging ? (
          <div className="text-purple-300 font-bold text-xs py-2 flex items-center justify-center space-x-2">
            <Upload className="w-4 h-4 animate-bounce" />
            <span>释放鼠标即可将文档或图片加入当前配置！</span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Filter tags */}
            <div className="flex items-center space-x-1 text-[11px]">
              <span className="text-zinc-500 mr-1">筛选:</span>
              {[
                { key: 'all', label: `全部 (${attachments.length})` },
                {
                  key: 'document',
                  label: `📄 文档 (${attachments.filter((a) => a.type === 'document').length})`,
                },
                {
                  key: 'image',
                  label: `🖼️ 图片 (${attachments.filter((a) => a.type === 'image').length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    ultraAudio.playUiClick();
                    setActiveFilter(tab.key as any);
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] transition-all cursor-pointer ${
                    activeFilter === tab.key
                      ? 'bg-zinc-800 text-white font-bold border border-zinc-600'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {attachments.length > 0 && (
              <div className="flex items-center space-x-1 text-[10px] text-zinc-500">
                <span>支持拖拽文件直接放入</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Attachments List */}
      {attachments.length === 0 ? (
        <div className="p-4 rounded-lg border border-dashed border-zinc-800 text-center text-zinc-500 space-y-1">
          <div className="text-xs">暂无挂载的文档或图片附件</div>
          <div className="text-[10px] text-zinc-600">
            点击上方按钮上传背景小说、战术规则书、人设细则或参考立绘图片，AI 将在请求时完整读取并理解它们。
          </div>
        </div>
      ) : filteredAttachments.length === 0 ? (
        <div className="p-3 text-center text-zinc-500 text-[11px]">
          所选分类下暂无附件
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
          {filteredAttachments.map((att) => {
            const isDoc = att.type === 'document';
            return (
              <div
                key={att.id}
                className={`p-2.5 rounded-lg border transition-all flex flex-col justify-between ${
                  att.enabled
                    ? 'bg-zinc-900/90 border-zinc-700 shadow-sm'
                    : 'bg-zinc-950/60 border-zinc-800/80 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                      {isDoc ? (
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                          <img
                            src={att.content}
                            alt={att.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className="truncate">
                        <div className="font-bold text-zinc-200 text-xs truncate flex items-center gap-1" title={att.name}>
                          <span className="truncate">{att.name}</span>
                          <span className={`px-1 py-0.2 rounded text-[9px] ${isDoc ? 'bg-cyan-950 text-cyan-300' : 'bg-amber-950 text-amber-300'}`}>
                            {isDoc ? '文档' : '图片'}
                          </span>
                        </div>
                        {att.description && (
                          <div className="text-[10px] text-zinc-400 truncate" title={att.description}>
                            {att.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Enable toggle */}
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-1">
                      <input
                        type="checkbox"
                        checked={att.enabled}
                        onChange={() => handleToggleAttachment(att.id)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Summary info */}
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/80">
                    <span>
                      {isDoc
                        ? `约 ${att.content.length} 字符`
                        : att.sizeBytes
                        ? `大小: ${(att.sizeBytes / 1024).toFixed(1)} KB`
                        : '图片资源'}
                    </span>
                    <span className={att.enabled ? 'text-emerald-400 font-bold' : 'text-zinc-600'}>
                      {att.enabled ? '✓ 已注入提示词' : '已暂停注入'}
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-2 flex items-center justify-end space-x-1">
                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setPreviewAttachment(att);
                    }}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
                    title="查看/预览内容"
                  >
                    <Eye className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      ultraAudio.playUiClick();
                      setEditingAttachment(JSON.parse(JSON.stringify(att)));
                    }}
                    className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-all cursor-pointer"
                    title="编辑名称与内容"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="p-1 rounded bg-zinc-800 hover:bg-rose-900/60 text-zinc-400 hover:text-rose-300 transition-all cursor-pointer"
                    title="删除该附件"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-MODAL: Preview Attachment */}
      {previewAttachment && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl space-y-3 font-mono text-xs animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center space-x-2">
                {previewAttachment.type === 'document' ? (
                  <FileText className="w-4 h-4 text-cyan-400" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                )}
                <span className="font-bold text-zinc-100 text-sm">{previewAttachment.name}</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-zinc-800 text-zinc-300">
                  {previewAttachment.type === 'document' ? '文档内容' : '图片预览'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAttachment(null)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[60vh] p-2 bg-black/70 rounded-lg border border-zinc-800 scrollbar-thin">
              {previewAttachment.type === 'document' ? (
                <pre className="text-zinc-200 text-xs whitespace-pre-wrap font-mono leading-relaxed select-text">
                  {previewAttachment.content}
                </pre>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2 py-4">
                  <img
                    src={previewAttachment.content}
                    alt={previewAttachment.name}
                    className="max-h-[50vh] max-w-full rounded-lg object-contain border border-zinc-700 shadow-md"
                    referrerPolicy="no-referrer"
                  />
                  {previewAttachment.description && (
                    <div className="text-xs text-zinc-400 text-center">
                      {previewAttachment.description}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-zinc-400 text-[11px]">
              <div>
                {previewAttachment.type === 'document'
                  ? `总字数: ${previewAttachment.content.length} 字`
                  : `图片大小: ${(previewAttachment.sizeBytes ? previewAttachment.sizeBytes / 1024 : 0).toFixed(1)} KB`}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleCopyContent(previewAttachment.content)}
                  className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center space-x-1 cursor-pointer"
                >
                  {copySuccess ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copySuccess ? '已复制！' : '复制内容'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Edit Attachment */}
      {editingAttachment && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 w-full max-w-xl flex flex-col shadow-2xl space-y-3 font-mono text-xs animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="font-bold text-zinc-100 flex items-center space-x-2">
                <Edit2 className="w-4 h-4 text-purple-400" />
                <span>编辑附件属性</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingAttachment(null)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-zinc-300 mb-1">附件名称/标题:</label>
                <input
                  type="text"
                  value={editingAttachment.name}
                  onChange={(e) =>
                    setEditingAttachment({ ...editingAttachment, name: e.target.value })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1">备注说明 (可选):</label>
                <input
                  type="text"
                  value={editingAttachment.description || ''}
                  onChange={(e) =>
                    setEditingAttachment({ ...editingAttachment, description: e.target.value })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-purple-500"
                  placeholder="如：战术规则书、角色心理设定、破限反拒答指令"
                />
              </div>

              {editingAttachment.type === 'document' && (
                <div>
                  <label className="block text-zinc-300 mb-1">文档文本内容:</label>
                  <textarea
                    rows={6}
                    value={editingAttachment.content}
                    onChange={(e) =>
                      setEditingAttachment({ ...editingAttachment, content: e.target.value })
                    }
                    className="w-full bg-black border border-zinc-700 rounded p-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-purple-500 leading-relaxed scrollbar-thin"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingAttachment(null)}
                className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
              >
                保存变更
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Paste Document Modal */}
      {isTextModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 w-full max-w-xl flex flex-col shadow-2xl space-y-3 font-mono text-xs animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="font-bold text-cyan-300 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>新建/粘贴参考文档</span>
              </div>
              <button
                type="button"
                onClick={() => setIsTextModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-zinc-300 mb-1">文档名称 (如: 战术条例.txt / 角色前史设定):</label>
                <input
                  type="text"
                  value={textDocName}
                  onChange={(e) => setTextDocName(e.target.value)}
                  placeholder="请输入文档名称..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1">备注说明 (可选):</label>
                <input
                  type="text"
                  value={textDocDesc}
                  onChange={(e) => setTextDocDesc(e.target.value)}
                  placeholder="如：核心世界观法则、对白参考范例等..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-zinc-300">文档详细内容 (支持 Markdown / 纯文本 / JSON):</label>
                  <span className="text-zinc-500 text-[10px]">{textDocContent.length} 字</span>
                </div>
                <textarea
                  rows={8}
                  value={textDocContent}
                  onChange={(e) => setTextDocContent(e.target.value)}
                  placeholder="在此直接粘贴或输入长篇设定文本、对白指导、战术手册或破限指令..."
                  className="w-full bg-black border border-zinc-700 rounded p-2.5 text-zinc-200 font-mono text-xs focus:outline-none focus:border-cyan-500 leading-relaxed scrollbar-thin"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsTextModalOpen(false)}
                className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateTextDoc}
                disabled={!textDocContent.trim()}
                className="px-4 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-bold disabled:opacity-50 cursor-pointer"
              >
                加入附件列表
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Image URL Modal */}
      {isImageUrlModalOpen && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 w-full max-w-lg flex flex-col shadow-2xl space-y-3 font-mono text-xs animate-scale-up">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="font-bold text-amber-300 flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>添加图片链接 / Base64</span>
              </div>
              <button
                type="button"
                onClick={() => setIsImageUrlModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-zinc-300 mb-1">图片名称:</label>
                <input
                  type="text"
                  value={imgName}
                  onChange={(e) => setImgName(e.target.value)}
                  placeholder="如: 角色战斗立绘参考图"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1">图片 URL 或 Base64 Data URL:</label>
                <textarea
                  rows={3}
                  value={imgUrl}
                  onChange={(e) => setImgUrl(e.target.value)}
                  placeholder="https://... 或 data:image/png;base64,..."
                  className="w-full bg-black border border-zinc-700 rounded p-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-amber-500 leading-relaxed scrollbar-thin"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1">图片说明 / 视觉描述 (可选):</label>
                <input
                  type="text"
                  value={imgDesc}
                  onChange={(e) => setImgDesc(e.target.value)}
                  placeholder="如：胸前能量核心处于红光剧烈闪烁状态"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsImageUrlModalOpen(false)}
                className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateImageUrl}
                disabled={!imgUrl.trim()}
                className="px-4 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-50 cursor-pointer"
              >
                添加图片
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
