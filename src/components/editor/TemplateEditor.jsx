import { useEditor, EditorContent, ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Node, mergeAttributes } from '@tiptap/core'
import styles from './TemplateEditor.module.css'

// ── Extensión custom: nodo Variable ────────────────────────────────────────
const VariableNode = Node.create({
  name: 'variable',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { nombre: { default: '' } }
  },

  parseHTML() {
    return [{ tag: 'span[data-variable]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-variable': HTMLAttributes.nombre }), `{{${HTMLAttributes.nombre}}}`]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableChip)
  },
})

function VariableChip({ node }) {
  return (
    <NodeViewWrapper as="span" className={styles.variableChip}>
      {`{{${node.attrs.nombre}}}`}
    </NodeViewWrapper>
  )
}

// ── Toolbar ────────────────────────────────────────────────────────────────
function Toolbar({ editor }) {
  if (!editor) return null
  const btn = (active, onClick, label) => (
    <button
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={label}
    >
      {label}
    </button>
  )
  return (
    <div className={styles.toolbar}>
      {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      'N')}
      {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    'I')}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'S')}
      <div className={styles.toolSep} />
      {btn(editor.isActive({ textAlign: 'left' }),    () => editor.chain().focus().setTextAlign('left').run(),    '⬤←')}
      {btn(editor.isActive({ textAlign: 'center' }),  () => editor.chain().focus().setTextAlign('center').run(),  '⬤')}
      {btn(editor.isActive({ textAlign: 'right' }),   () => editor.chain().focus().setTextAlign('right').run(),   '→⬤')}
      <div className={styles.toolSep} />
      {btn(editor.isActive('bulletList'),  () => editor.chain().focus().toggleBulletList().run(),  '• Lista')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), '1. Lista')}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export default function TemplateEditor({ content, onEditorReady }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      VariableNode,
    ],
    content: content || '<p></p>',
    onTransaction: ({ editor }) => {
      onEditorReady?.(editor)
    },
    onCreate: ({ editor }) => {
      onEditorReady?.(editor)
    },
  })

  return (
    <div className={styles.wrapper}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className={styles.editorContent} />
    </div>
  )
}

// ── Utilidades exportadas ──────────────────────────────────────────────────

// Inserta una variable en la posición del cursor
export function insertarVariable(editor, nombre) {
  if (!editor) return
  editor.chain().focus().insertContent({
    type: 'variable',
    attrs: { nombre },
  }).run()
}

// Extrae qué variables están presentes en el documento
export function variablesEnDocumento(editor) {
  if (!editor) return new Set()
  const usadas = new Set()
  editor.state.doc.descendants(node => {
    if (node.type.name === 'variable') usadas.add(node.attrs.nombre)
  })
  return usadas
}

// Serializa el contenido del editor a HTML con {{variable}} como texto plano
export function editorAHtml(editor) {
  if (!editor) return ''
  // Clonar el HTML del editor y reemplazar chips por texto plano
  const temp = document.createElement('div')
  temp.innerHTML = editor.getHTML()
  temp.querySelectorAll('[data-variable]').forEach(el => {
    el.replaceWith(`{{${el.dataset.variable}}}`)
  })
  return temp.innerHTML
}
