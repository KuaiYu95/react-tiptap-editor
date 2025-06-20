import ErrorIcon from '@mui/icons-material/Error';
import { Box, CircularProgress, Divider, MenuItem, Select, Skeleton, Stack } from "@mui/material";
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { EditorContent, type Editor } from "@tiptap/react";
import getSelectedHTML from 'ct-tiptap-editor/utils/selection-html';
import SSEClient from "ct-tiptap-editor/utils/sse";
import React, { useEffect, useRef, useState } from "react";
import useTiptapEditor from '../hook/useTiptapEditor';
import { AiIcon } from "../icons/ai-icon";
import { ArrowIcon } from "../icons/arrow-icon";
import EditorToolbarButton from "./EditorToolbarButton";

interface EditorAIAssistantProps {
  editor: Editor
  aiUrl?: string
  onError?: (error: Error) => void
}

const EditorAIAssistant = ({ editor, aiUrl, onError }: EditorAIAssistantProps) => {
  const sseClientRef = useRef<SSEClient<string> | null>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');

  const readEditor = useTiptapEditor({
    content,
    editable: false,
  })

  const defaultEditor = useTiptapEditor({
    content: '',
    editable: false,
  })

  const UploadOptions = [
    { id: 'rephrase', label: '文本润色' },
  ];

  const handleChange = async (e: { target: { value: string } }) => {
    if (!aiUrl) {
      onError?.(new Error('未配置 AI 地址'));
      return;
    }
    const value = e.target.value;
    if (value === 'rephrase') {
      const selectedHtml = getSelectedHTML(editor);
      defaultEditor?.setContent(selectedHtml)
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, "\n");
      if (!selectedText) {
        onError?.(new Error('请先选择文本'));
        return;
      }
      if (!sseClientRef.current) return
      setOpen(true)
      setLoading(true)
      sseClientRef.current.subscribe(JSON.stringify({
        text: selectedText,
        action: 'rephrase',
        stream: true,
      }), (data) => {
        setContent((prev) => {
          const newContent = prev + data;
          readEditor?.setContent(newContent);
          return newContent;
        });
      });
    }
  };

  const handleClose = () => {
    sseClientRef.current?.unsubscribe();
    setContent('')
    setOpen(false)
    defaultEditor?.setContent('')
    readEditor?.setContent('')
  }

  useEffect(() => {
    if (!aiUrl) return
    sseClientRef.current = new SSEClient({
      url: aiUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      onComplete: () => {
        setLoading(false)
      },
      onError: (error) => {
        setLoading(false)
      }
    });
  }, []);

  useEffect(() => {
    if (dialogContentRef.current) {
      dialogContentRef.current.scrollTop = dialogContentRef.current.scrollHeight;
    }
  }, [content]);

  return <>
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      PaperProps={{ sx: { width: 1000, borderRadius: '10px' } }}
    >
      <DialogTitle sx={{ p: 0, pb: 2 }}>
        {loading ? (
          <Stack direction={'row'} alignItems={'center'} gap={1} sx={{ lineHeight: '28px', pl: 3, pt: 3 }}>
            <CircularProgress size={16} />
            <Box>AI 润色中...</Box>
          </Stack>
        ) : (
          <Stack direction={'row'} alignItems={'center'} gap={1} sx={{ lineHeight: '28px', pl: 3, pt: 3 }}>
            <ErrorIcon sx={{ fontSize: 20, color: 'warning.main' }} />
            <Box>是否使用以下文本替换选中内容</Box>
            <Box sx={{ color: 'text.disabled', fontSize: 12 }}>({content.length} 字)</Box>
          </Stack>
        )}
      </DialogTitle>
      <DialogContent sx={{ p: 0, px: 3 }}>
        <Box ref={dialogContentRef} sx={{ maxHeight: '60vh', overflow: 'auto' }}>
          <Stack direction={'row'}>
            <Box sx={{ width: '50%', flex: 1, paddingRight: 1 }}>
              {defaultEditor?.editor && <Box className="editor-container" >
                <EditorContent editor={defaultEditor.editor} />
              </Box>}
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box sx={{ width: '50%', flex: 1, paddingLeft: 1 }}>
              {readEditor?.editor && content.length > 0 && <Box className="editor-container" sx={{
                '.tiptap.ProseMirror': {
                  padding: '0px',
                }
              }}>
                <EditorContent editor={readEditor.editor} />
              </Box>}
              {loading && <Skeleton variant="text" height={20} width={'100%'} />}
              {loading && <Skeleton variant="text" height={20} width={'60%'} />}
            </Box>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose}>
          取消
        </Button>
        <Button variant="contained" onClick={() => {
          const { from, to } = editor.state.selection;
          editor.commands.insertContentAt({ from, to }, content);
          setOpen(false);
          setContent('');
          defaultEditor?.setContent('')
          readEditor?.setContent('')
        }} disabled={loading}>
          替换
        </Button>
      </DialogActions>
    </Dialog>
    <Select
      value={'none'}
      onChange={handleChange}
      renderValue={() => {
        return <EditorToolbarButton
          tip={'AI'}
          icon={<Stack direction={'row'} alignItems={'center'} justifyContent='center' sx={{ mr: 0.5 }}>
            <AiIcon sx={{ fontSize: 14 }} />
          </Stack>}
        />;
      }}
      IconComponent={({ className, ...rest }) => {
        return (
          <ArrowIcon
            sx={{
              position: 'absolute',
              right: 0,
              flexSelf: 'center',
              fontSize: 14,
              flexShrink: 0,
              mr: 0,
              transform: className?.includes('MuiSelect-iconOpen') ? 'rotate(-180deg)' : 'none',
              transition: 'transform 0.3s',
              cursor: 'pointer',
              pointerEvents: 'none'
            }}
            {...rest}
          />
        );
      }}
    >
      <MenuItem key={'none'} value={'none'} sx={{ display: 'none' }}>
        <AiIcon sx={{ fontSize: 14 }} />
        <Box sx={{ ml: 0.5 }}>无</Box>
      </MenuItem>
      {UploadOptions.map(it => {
        return <MenuItem key={it.id} value={it.id}>
          <Stack direction={'row'} alignItems={'center'} gap={0.5}>
            <Box>{it.label}</Box>
          </Stack>
        </MenuItem>
      })}
    </Select>
  </>
}

export default EditorAIAssistant