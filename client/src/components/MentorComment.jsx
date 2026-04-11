import React, { useState } from 'react'

function formatDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export default function MentorComment({ section, menteeId, comments = [], onAdd, onUpdate, onDelete }) {
  const [isAdding, setIsAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const sectionComments = comments.filter(c => c.section === section)

  async function handleAdd() {
    if (!newText.trim()) return
    setIsSubmitting(true)
    try {
      await onAdd(section, newText.trim())
      setNewText('')
      setIsAdding(false)
    } catch (err) {
      console.error('Failed to add comment:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdate(commentId) {
    if (!editText.trim()) return
    setIsSubmitting(true)
    try {
      await onUpdate(commentId, editText.trim())
      setEditingId(null)
      setEditText('')
    } catch (err) {
      console.error('Failed to update comment:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(commentId) {
    if (!confirm('Delete this note?')) return
    try {
      await onDelete(commentId)
    } catch (err) {
      console.error('Failed to delete comment:', err)
    }
  }

  function startEdit(comment) {
    setEditingId(comment.id)
    setEditText(comment.comment)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  return (
    <div className="mt-3 space-y-2">
      {sectionComments.map(comment => (
        <div key={comment.id} className="border-l-4 border-[#1F4E79] pl-3 py-1 bg-blue-50 rounded-r-md">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#1F4E79] text-white flex items-center justify-center text-xs font-bold mt-0.5">
              BO
            </div>
            <div className="flex-1">
              {editingId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-[#1F4E79]"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(comment.id)}
                      disabled={isSubmitting}
                      className="text-xs bg-[#1F4E79] text-white px-3 py-1 rounded hover:bg-[#1a4268] disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#1F4E79] font-medium">
                    Brian's note — we'll discuss this on our next call.
                  </p>
                  <p className="text-sm text-gray-800 mt-0.5 leading-relaxed">{comment.comment}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                    <button
                      onClick={() => startEdit(comment)}
                      className="text-xs text-[#1F4E79] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-red-400 hover:text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {isAdding ? (
        <div className="space-y-2 mt-2">
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Write a note for this section..."
            className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={isSubmitting || !newText.trim()}
              className="text-sm bg-[#1F4E79] text-white px-4 py-1.5 rounded-lg hover:bg-[#1a4268] disabled:opacity-50 font-medium"
            >
              {isSubmitting ? 'Saving...' : 'Save Note'}
            </button>
            <button
              onClick={() => { setIsAdding(false); setNewText('') }}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="text-xs text-[#1F4E79] hover:text-[#1a4268] font-medium flex items-center gap-1 mt-1 no-print"
        >
          <span>+</span> Add Note
        </button>
      )}
    </div>
  )
}
