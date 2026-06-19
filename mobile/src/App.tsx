import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type View =
  | 'home'
  | 'login'
  | 'register'
  | 'events'
  | 'publish'
  | 'check-in'
  | 'profile'

type User = {
  id: number
  student_no: string
  name: string
  phone?: string | null
  avatar_url?: string | null
}

type AttendanceRecord = {
  id: number
  snapshot_url: string
  status: string
  message: string
  match_score?: number | null
  created_at: string
  attendance_event_id?: number | null
  attendance_event?: EventItem | null
}

type CheckInRecord = {
  id: number
}

type CheckInResponse = {
  success: boolean
  message: string
  record: CheckInRecord
}

type StatusTone = 'neutral' | 'success' | 'error'

type Notice = {
  tone: StatusTone
  message: string
}

type LoginState = {
  studentNo: string
  password: string
}

type RegisterState = {
  studentNo: string
  name: string
  phone: string
  password: string
  confirmPassword: string
  file: File | null
}

type EventItem = {
  id: number
  title: string
  description: string
  start_time: string
  end_time: string
  created_by_user_id: number
  created_at: string
  updated_at: string
}

type PublishState = {
  title: string
  description: string
  endTime: string
}

const TOKEN_STORAGE_KEY = 'cloud-proj-token'
const USER_STORAGE_KEY = 'cloud-proj-user'
const isLocalHost =
  typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname)
const DEFAULT_API_BASE_URL = isLocalHost ? 'http://127.0.0.1:8000/api' : '/api'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
const SERVER_BASE_URL =
  API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')
    ? API_BASE_URL.replace(/\/api\/?$/, '')
    : ''
const MAX_UPLOAD_SIDE = 1600
const MAX_UPLOAD_BYTES = 900 * 1024
const MIN_JPEG_QUALITY = 0.55

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('图片读取失败'))
    }
    image.src = objectUrl
  })
}

async function compressImageFile(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file
  }

  const image = await loadImageFromFile(file)
  const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('浏览器不支持图片压缩画布')
  }

  context.drawImage(image, 0, 0, width, height)

  let quality = 0.86
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  while (blob && blob.size > MAX_UPLOAD_BYTES && quality > MIN_JPEG_QUALITY) {
    quality -= 0.08
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  }

  if (!blob) {
    throw new Error('图片压缩失败')
  }

  const targetName = file.name.replace(/\.[^.]+$/, '') || `image-${Date.now()}`
  return new File([blob], `${targetName}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDateTimeLocalValue(value: Date): string {
  const offset = value.getTimezoneOffset()
  const localValue = new Date(value.getTime() - offset * 60 * 1000)
  return localValue.toISOString().slice(0, 16)
}

function resolveAssetUrl(path?: string | null): string {
  if (!path) {
    return ''
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${SERVER_BASE_URL}${path}`
}

function App() {
  const defaultEnd = toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000))

  const [view, setView] = useState<View>('home')
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) ?? '')
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(USER_STORAGE_KEY)
    if (!saved) {
      return null
    }
    try {
      return JSON.parse(saved) as User
    } catch {
      return null
    }
  })
  const [registerForm, setRegisterForm] = useState<RegisterState>({
    studentNo: '',
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    file: null,
  })
  const [loginForm, setLoginForm] = useState<LoginState>({ studentNo: '', password: '' })
  const [facePhoto, setFacePhoto] = useState<File | null>(null)
  const [checkInPhoto, setCheckInPhoto] = useState<File | null>(null)
  const [registerPhotoPreviewUrl, setRegisterPhotoPreviewUrl] = useState('')
  const [facePhotoPreviewUrl, setFacePhotoPreviewUrl] = useState('')
  const [checkInPreviewUrl, setCheckInPreviewUrl] = useState('')
  const [viewerImageUrl, setViewerImageUrl] = useState('')
  const [viewerTitle, setViewerTitle] = useState('')
  const [profile, setProfile] = useState<User | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null)
  const [publishForm, setPublishForm] = useState<PublishState>({
    title: '',
    description: '',
    endTime: defaultEnd,
  })
  const [notice, setNotice] = useState<Notice>({
    tone: 'neutral',
    message: '欢迎使用云端人脸签到系统。',
  })

  const registerPhotoInputRef = useRef<HTMLInputElement | null>(null)
  const facePhotoInputRef = useRef<HTMLInputElement | null>(null)
  const checkInPhotoInputRef = useRef<HTMLInputElement | null>(null)

  const authHeaders = useMemo<Record<string, string>>(() => {
    return token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>)
  }, [token])

  const activeEvents = useMemo(() => {
    const currentTime = Date.now()
    return events
      .filter((event) => {
        const start = new Date(event.start_time).getTime()
        const end = new Date(event.end_time).getTime()
        return start <= currentTime && currentTime <= end
      })
      .sort((left, right) => new Date(left.start_time).getTime() - new Date(right.start_time).getTime())
  }, [events])

  const selectedEvent = useMemo(() => {
    return activeEvents.find((event) => event.id === selectedEventId) ?? activeEvents[0] ?? null
  }, [activeEvents, selectedEventId])

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token)
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
    }
  }, [token])

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(currentUser))
    } else {
      localStorage.removeItem(USER_STORAGE_KEY)
    }
  }, [currentUser])

  useEffect(() => {
    if (!selectedEventId && activeEvents[0]) {
      setSelectedEventId(activeEvents[0].id)
    }
  }, [activeEvents, selectedEventId])

  useEffect(() => {
    void refreshEvents()
  }, [])

  useEffect(() => {
    if (!token) {
      setProfile(null)
      setRecords([])
      return
    }

    void refreshProfile()
  }, [token])

  useEffect(() => {
    if (!registerForm.file) {
      setRegisterPhotoPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(registerForm.file)
    setRegisterPhotoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [registerForm.file])

  useEffect(() => {
    if (!facePhoto) {
      setFacePhotoPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(facePhoto)
    setFacePhotoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [facePhoto])

  useEffect(() => {
    if (!checkInPhoto) {
      setCheckInPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(checkInPhoto)
    setCheckInPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [checkInPhoto])

  function showNotice(message: string, tone: StatusTone = 'neutral') {
    setNotice({ message, tone })
  }

  function openImageViewer(imageUrl: string, title: string) {
    setViewerImageUrl(imageUrl)
    setViewerTitle(title)
  }

  function closeImageViewer() {
    setViewerImageUrl('')
    setViewerTitle('')
  }

  async function applySelectedImage(
    file: File | null,
    setter: (file: File | null) => void,
    label: string,
  ) {
    if (!file) {
      setter(null)
      return
    }

    try {
      const compressedFile = await compressImageFile(file)
      setter(compressedFile)
      if (compressedFile.size < file.size) {
        showNotice(`${label}已自动压缩后待上传`, 'neutral')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '图片处理失败'
      showNotice(`${label}处理失败：${message}`, 'error')
      setter(null)
    }
  }

  async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init)
    const rawText = await response.text()
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      const normalizedPreview = rawText.replace(/\s+/g, ' ').slice(0, 120)
      throw new Error(
        normalizedPreview.includes('413') || response.status === 413
          ? '上传图片过大，服务器已拒绝请求。请重新选择图片，或联系管理员放宽上传大小限制。'
          : `服务器返回了非 JSON 响应（HTTP ${response.status || 'unknown'}）。${normalizedPreview || '请检查 Nginx 反向代理配置。'}`,
      )
    }

    const data = JSON.parse(rawText) as T & { detail?: string; message?: string }
    if (!response.ok) {
      throw new Error(data.detail ?? data.message ?? '请求失败')
    }
    return data
  }

  async function refreshProfile() {
    if (!token) {
      return
    }

    try {
      const [userData, recordData] = await Promise.all([
        requestJson<User>(`${API_BASE_URL}/users/me`, { headers: authHeaders }),
        requestJson<AttendanceRecord[]>(`${API_BASE_URL}/attendance/records`, { headers: authHeaders }),
      ])
      setCurrentUser(userData)
      setProfile(userData)
      setRecords(recordData)
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取个人信息失败'
      showNotice(message, 'error')
    }
  }

  async function refreshEvents() {
    try {
      const eventData = await requestJson<EventItem[]>(`${API_BASE_URL}/events`)
      setEvents(eventData)
    } catch (error) {
      const message = error instanceof Error ? error.message : '获取签到事件失败'
      showNotice(message, 'error')
    }
  }

  async function loginAndEnterHome(studentNo: string, password: string) {
    const data = await requestJson<{ access_token: string; user: User }>(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_no: studentNo, password }),
    })

    setToken(data.access_token)
    setCurrentUser(data.user)
    setView('home')
    showNotice(`欢迎回来，${data.user.name}`, 'success')
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!registerForm.file) {
      showNotice('请先选择标准人脸照片', 'error')
      return
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      showNotice('两次输入的密码不一致', 'error')
      return
    }

    const formData = new FormData()
    formData.append('student_no', registerForm.studentNo)
    formData.append('name', registerForm.name)
    formData.append('phone', registerForm.phone)
    formData.append('password', registerForm.password)
    formData.append('face_photo', registerForm.file)

    try {
      await requestJson<User>(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        body: formData,
      })
      await loginAndEnterHome(registerForm.studentNo, registerForm.password)
      setRegisterForm({
        studentNo: '',
        name: '',
        phone: '',
        password: '',
        confirmPassword: '',
        file: null,
      })
      showNotice('注册成功，已自动登录', 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '注册失败'
      showNotice(message, 'error')
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await loginAndEnterHome(loginForm.studentNo, loginForm.password)
    } catch (error) {
      const message = error instanceof Error ? error.message : '登录失败'
      showNotice(message, 'error')
    }
  }

  async function handleLogout() {
    try {
      if (token) {
        await requestJson<{ message: string }>(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { ...authHeaders },
        })
      }
    } catch {
      // Logout on the client even if the backend response fails.
    }

    setToken('')
    setCurrentUser(null)
    setProfile(null)
    setRecords([])
    setView('home')
    showNotice('已注销登录', 'success')
  }

  async function handleFacePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!facePhoto) {
      showNotice('请先选择要更新的标准照片', 'error')
      return
    }

    const formData = new FormData()
    formData.append('face_photo', facePhoto)

    try {
      const data = await requestJson<{ message: string }>(`${API_BASE_URL}/users/me/face-photo`, {
        method: 'POST',
        headers: { ...authHeaders },
        body: formData,
      })
      setFacePhoto(null)
      await refreshProfile()
      showNotice(data.message, 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : '上传失败'
      showNotice(message, 'error')
    }
  }

  async function handleCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!checkInPhoto) {
      showNotice('请先选择签到照片', 'error')
      return
    }

    if (!selectedEvent) {
      showNotice('当前暂无可签到的事件', 'error')
      return
    }

    const formData = new FormData()
    formData.append('attendance_event_id', String(selectedEvent.id))
    formData.append('face_photo', checkInPhoto)

    try {
      const data = await requestJson<CheckInResponse>(`${API_BASE_URL}/attendance/check-in`, {
        method: 'POST',
        body: formData,
      })
      setCheckInPhoto(null)
      showNotice(`${selectedEvent.title}：${data.message}`, data.success ? 'success' : 'error')
      if (data.success) {
        window.setTimeout(() => {
          setView('home')
        }, 1200)
      }
      if (token) {
        await refreshProfile()
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '签到失败'
      showNotice(message, 'error')
    }
  }

  function handleOpenPublish() {
    if (!token) {
      showNotice('请先登录后再发布签到', 'error')
      setView('login')
      return
    }
    setView('publish')
  }

  function handleEnterProfile() {
    if (!token) {
      setView('login')
      showNotice('请先登录后查看个人信息', 'error')
      return
    }
    void refreshProfile()
    setView('profile')
  }

  function handlePublishEvent(event: FormEvent<HTMLFormElement>) {
    void (async () => {
      event.preventDefault()

      const end = new Date(publishForm.endTime)
      const currentTime = new Date()

      if (end <= currentTime) {
        showNotice('结束时间必须晚于发布时间', 'error')
        return
      }

      try {
        await requestJson<EventItem>(`${API_BASE_URL}/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
          },
          body: JSON.stringify({
            title: publishForm.title.trim(),
            description: publishForm.description.trim(),
            end_time: new Date(publishForm.endTime).toISOString(),
          }),
        })
        await refreshEvents()
        setPublishForm({
          title: '',
          description: '',
          endTime: toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)),
        })
        showNotice('签到事件已发布', 'success')
        setView('events')
      } catch (error) {
        const message = error instanceof Error ? error.message : '发布签到事件失败'
        showNotice(message, 'error')
      }
    })()
  }

  function renderHome() {
    return (
      <section className="hero-card">
        <div className="eyebrow">Cloud Face Attendance</div>

        <div className="hero-actions">
          <button className="primary-action" onClick={() => setView('events')}>进入签到</button>
          <button className="ghost-action" onClick={handleOpenPublish}>签到发布</button>
        </div>
        <div className="hero-grid">
          <article className="metric-card">
            <span>当前状态</span>
            <strong>{token ? '已登录' : '游客模式'}</strong>
          </article>
          <article className="metric-card">
            <span>可签到事件</span>
            <strong>{activeEvents.length} 个</strong>
          </article>
          <article className="metric-card">
            <span>当前接口</span>
            <strong>前后端已联通</strong>
          </article>
        </div>
      </section>
    )
  }

  function renderEvents() {
    return (
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">签到选择</p>
            <h2>当前可签到事件</h2>
          </div>
          <button className="text-action" onClick={() => setView('home')}>返回首页</button>
        </div>
        {activeEvents.length === 0 ? (
          <div className="empty-state">
            <strong>当前暂无进行中的签到事件</strong>
            <p>只有已开始且未结束的签到事件会展示在这里。</p>
          </div>
        ) : (
          <div className="event-list">
            {activeEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className={`event-card ${selectedEvent?.id === event.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedEventId(event.id)
                  setView('check-in')
                }}
              >
                <span className="event-tag">进行中</span>
                <strong>{event.title}</strong>
                <span>{formatDateTime(event.start_time)} - {formatDateTime(event.end_time)}</span>
                <p>{event.description}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    )
  }

  function renderPublish() {
    return (
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">签到发布</p>
            <h2>创建新的签到事件</h2>
          </div>
          <button className="text-action" onClick={() => setView('home')}>返回首页</button>
        </div>
        <form className="form-grid" onSubmit={handlePublishEvent}>
          <label className="field">
            <span>事件名称</span>
            <input
              placeholder="例如：我只是想让你签个到"
              value={publishForm.title}
              onChange={(event) => setPublishForm({ ...publishForm, title: event.target.value })}
              required
            />
          </label>
          <div className="field">
            <span>开始时间</span>
            <div className="inline-note">不让你改喵~</div>
          </div>
          <label className="field">
            <span>结束时间</span>
            <input
              type="datetime-local"
              min={toDateTimeLocalValue(new Date(Date.now() + 60 * 1000))}
              value={publishForm.endTime}
              onChange={(event) => setPublishForm({ ...publishForm, endTime: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>事件描述</span>
            <textarea
              rows={4}
              placeholder="填写签到说明，凭什么要签到"
              value={publishForm.description}
              onChange={(event) => setPublishForm({ ...publishForm, description: event.target.value })}
              required
            />
          </label>
          <button type="submit">发布签到事件</button>
        </form>
      </section>
    )
  }

  function renderCheckIn() {
    return (
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">签到界面</p>
            <h2>{selectedEvent?.title ?? '选择签到事件'}</h2>
          </div>
          <button className="text-action" onClick={() => setView('events')}>返回事件列表</button>
        </div>
        {selectedEvent ? (
          <>
            <div className="detail-card">
              <span>开始时间：{formatDateTime(selectedEvent.start_time)}</span>
              <span>结束时间：{formatDateTime(selectedEvent.end_time)}</span>
              <p>{selectedEvent.description}</p>
            </div>
            <form className="form-grid" onSubmit={handleCheckIn}>
              <div className="field">
                <span>签到照片</span>
                <div className="upload-actions">
                  <input
                    ref={checkInPhotoInputRef}
                    className="hidden-file-input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => void applySelectedImage(event.target.files?.[0] ?? null, setCheckInPhoto, '签到照片')}
                  />
                  <button type="button" className="ghost-action" onClick={() => checkInPhotoInputRef.current?.click()}>
                    选择图片
                  </button>
                </div>
                {checkInPreviewUrl ? (
                  <button
                    type="button"
                    className="image-preview-card"
                    onClick={() => openImageViewer(checkInPreviewUrl, '签到照片预览')}
                  >
                    <img src={checkInPreviewUrl} alt="签到照片预览" />
                    <span>点击放大查看</span>
                  </button>
                ) : (
                  <div className="image-preview-empty">Preview~</div>
                )}
              </div>
              <button type="submit">确认签到</button>
            </form>
          </>
        ) : (
          <div className="empty-state">
            <strong>尚未选择签到事件</strong>
            <p>请先从签到选择界面进入具体事件。</p>
          </div>
        )}
      </section>
    )
  }

  function renderLogin() {
    return (
      <section className="panel auth-panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">登录</p>
            <h2>登录后可发布签到并管理照片库</h2>
          </div>
          <button className="text-action" onClick={() => setView('home')}>返回首页</button>
        </div>
        <form onSubmit={handleLogin} className="form-grid">
          <label className="field">
            <span>用户名 / 学号</span>
            <input
              placeholder="请输入学号或工号"
              value={loginForm.studentNo}
              onChange={(event) => setLoginForm({ ...loginForm, studentNo: event.target.value })}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              type="password"
              placeholder="请输入密码"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit">立即登录</button>
        </form>
        <button className="ghost-action full-width" onClick={() => setView('register')}>没有账号，去注册</button>
      </section>
    )
  }

  function renderRegister() {
    return (
      <section className="panel auth-panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">注册</p>
            <h2>录入标准人脸照片并创建账号</h2>
          </div>
          <button className="text-action" onClick={() => setView('login')}>返回登录</button>
        </div>
        <form onSubmit={handleRegister} className="form-grid">
          <label className="field">
            <span>用户名 / 学号</span>
            <input
              placeholder="请输入学号或工号"
              value={registerForm.studentNo}
              onChange={(event) => setRegisterForm({ ...registerForm, studentNo: event.target.value })}
              autoComplete="username"
              required
            />
          </label>
          <label className="field">
            <span>姓名</span>
            <input
              placeholder="请输入真实姓名"
              value={registerForm.name}
              onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })}
              autoComplete="name"
              required
            />
          </label>
          <label className="field">
            <span>手机号</span>
            <input
              placeholder="请输入手机号"
              value={registerForm.phone}
              onChange={(event) => setRegisterForm({ ...registerForm, phone: event.target.value })}
              autoComplete="tel"
            />
          </label>
          <label className="field">
            <span>密码</span>
            <input
              type="password"
              placeholder="请输入密码"
              value={registerForm.password}
              onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="field">
            <span>确认密码</span>
            <input
              type="password"
              placeholder="请再次输入密码"
              value={registerForm.confirmPassword}
              onChange={(event) => setRegisterForm({ ...registerForm, confirmPassword: event.target.value })}
              autoComplete="new-password"
              required
            />
          </label>
          <div className="field">
            <span>标准人脸照片</span>
            <div className="upload-actions">
              <input
                ref={registerPhotoInputRef}
                className="hidden-file-input"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  void applySelectedImage(
                    event.target.files?.[0] ?? null,
                    (file) => setRegisterForm((current) => ({ ...current, file })),
                    '标准照片',
                  )
                }
                required
              />
              <button type="button" className="ghost-action" onClick={() => registerPhotoInputRef.current?.click()}>
                选择图片
              </button>
            </div>
            {registerPhotoPreviewUrl ? (
              <button
                type="button"
                className="image-preview-card"
                onClick={() => openImageViewer(registerPhotoPreviewUrl, '注册标准照片预览')}
              >
                <img src={registerPhotoPreviewUrl} alt="注册标准照片预览" />
                <span>点击放大查看</span>
              </button>
            ) : (
              <div className="image-preview-empty">注意使用正脸清晰照片喵</div>
            )}
          </div>
          <button type="submit">注册并自动登录</button>
        </form>
      </section>
    )
  }

  function renderProfile() {
    return (
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="section-kicker">个人信息</p>
            <h2>{profile?.name ?? currentUser?.name ?? '未登录用户'}</h2>
          </div>
          <button className="text-action" onClick={() => setView('home')}>返回首页</button>
        </div>
        {profile ?? currentUser ? (
          <>
            <div className="profile-card">
              <img
                className="profile-avatar"
                src={resolveAssetUrl((profile ?? currentUser)?.avatar_url) || 'https://dummyimage.com/96x96/1d2b42/ffffff&text=U'}
                alt="用户头像"
              />
              <div className="profile-meta">
                <span>学号 / 工号：{(profile ?? currentUser)?.student_no}</span>
                <span>姓名：{(profile ?? currentUser)?.name}</span>
                <span>手机号：{(profile ?? currentUser)?.phone || '未填写'}</span>
              </div>
            </div>

            <form className="form-grid compact-form" onSubmit={handleFacePhoto}>
              <div className="field">
                <span>更新标准照片</span>
                <div className="upload-actions">
                  <input
                    ref={facePhotoInputRef}
                    className="hidden-file-input"
                    type="file"
                    accept="image/*"
                    onChange={(event) => void applySelectedImage(event.target.files?.[0] ?? null, setFacePhoto, '标准照片')}
                  />
                  <button type="button" className="ghost-action" onClick={() => facePhotoInputRef.current?.click()}>
                    选择图片
                  </button>
                </div>
                {facePhotoPreviewUrl ? (
                  <button
                    type="button"
                    className="image-preview-card"
                    onClick={() => openImageViewer(facePhotoPreviewUrl, '标准照片预览')}
                  >
                    <img src={facePhotoPreviewUrl} alt="标准照片预览" />
                    <span>点击放大查看</span>
                  </button>
                ) : (
                  <div className="image-preview-empty">Preview~</div>
                )}
              </div>
              <button type="submit">上传标准照片</button>
            </form>

            <div className="records-card">
              <div className="section-head slim">
                <div>
                  <p className="section-kicker">签到记录</p>
                  <h3>个人签到历史</h3>
                </div>
                <button className="text-action" onClick={() => void refreshProfile()}>刷新</button>
              </div>
              {records.length === 0 ? (
                <div className="empty-state">
                  <strong>暂无可展示的签到记录喵</strong>
                </div>
              ) : (
                <div className="record-list">
                  {records.map((record) => (
                    <article key={record.id} className="record-item">
                      <div>
                        <strong>记录 #{record.id}</strong>
                        <span>{formatDateTime(record.created_at)}</span>
                      </div>
                      <div>
                        <span>{record.attendance_event?.title ?? '未关联事件'}</span>
                        <span>{record.status}</span>
                      </div>
                      <p>{record.message}</p>
                      {typeof record.match_score === 'number' ? <p>匹配分数：{record.match_score.toFixed(3)}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </div>

            <button className="danger-action full-width" onClick={() => void handleLogout()}>注销登录</button>
          </>
        ) : (
          <div className="empty-state">
            <strong>当前未登录</strong>
            <p>请先登录后查看个人信息与签到记录。</p>
          </div>
        )}
      </section>
    )
  }

  function renderContent() {
    switch (view) {
      case 'events':
        return renderEvents()
      case 'publish':
        return renderPublish()
      case 'check-in':
        return renderCheckIn()
      case 'login':
        return renderLogin()
      case 'register':
        return renderRegister()
      case 'profile':
        return renderProfile()
      case 'home':
      default:
        return renderHome()
    }
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <button className="brand-block" onClick={() => setView('home')}>
          <span className="brand-mark">CF</span>
          <span className="brand-copy">
            <strong>云端人脸签到</strong>
          </span>
        </button>
        <button className="profile-trigger" onClick={token ? handleEnterProfile : () => setView('login')}>
          {currentUser?.avatar_url ? (
            <img src={resolveAssetUrl(currentUser.avatar_url)} alt="用户头像" />
          ) : (
            <span>{token ? (currentUser?.name?.slice(0, 1) ?? 'U') : '登录'}</span>
          )}
        </button>
      </header>

      <section className={`notice-banner ${notice.tone}`}>
        <span className="notice-dot" />
        <p>{notice.message}</p>
      </section>

      {renderContent()}
      {viewerImageUrl ? (
        <div className="overlay-shell" onClick={closeImageViewer}>
          <div className="overlay-panel image-viewer-panel" onClick={(event) => event.stopPropagation()}>
            <div className="overlay-head">
              <div>
                <p className="section-kicker">图片预览</p>
                <h3>{viewerTitle}</h3>
              </div>
              <button className="text-action" onClick={closeImageViewer}>关闭</button>
            </div>
            <img className="viewer-image" src={viewerImageUrl} alt={viewerTitle} />
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default App
