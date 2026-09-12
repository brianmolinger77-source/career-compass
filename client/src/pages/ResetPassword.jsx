import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../utils/api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [requestFailed, setRequestFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setRequestFailed(false)

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      await resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.message)
      setRequestFailed(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-[#1F4E79] px-6 py-5">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-white">Career Compass</h1>
          <p className="text-blue-200 text-sm mt-0.5">Military-to-Civilian Career Navigation</p>
        </div>
      </div>

      {/* Reset password card */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#1F4E79] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Reset Password</h2>
            {!token ? null : success ? (
              <p className="text-gray-500 text-sm mt-1">Your password has been updated</p>
            ) : (
              <p className="text-gray-500 text-sm mt-1">Choose a new password for your account</p>
            )}
          </div>

          {!token ? (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-700">This reset link is invalid. Please request a new one.</p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/mentor/forgot-password')}
                className="w-full bg-[#C65911] hover:bg-[#a34a0e] text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                Request new link
              </button>
            </div>
          ) : success ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <p className="text-sm text-green-700">Your password has been reset.</p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/mentor/login')}
                className="w-full bg-[#C65911] hover:bg-[#a34a0e] text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                Continue to login
              </button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter a new password"
                    required
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4E79] focus:border-transparent"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                    <p className="text-sm text-red-700">{error}</p>
                    {requestFailed && (
                      <button
                        type="button"
                        onClick={() => navigate('/mentor/forgot-password')}
                        className="text-sm text-red-700 underline mt-1"
                      >
                        Request a new link
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="w-full bg-[#C65911] hover:bg-[#a34a0e] text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            </>
          )}

          <p className="text-xs text-gray-500 text-center mt-6">
            Career Compass &mdash; Military Veterans Career Program
          </p>
        </div>
      </div>
    </div>
  )
}
