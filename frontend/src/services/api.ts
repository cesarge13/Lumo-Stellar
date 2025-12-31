// Cliente API para comunicarse con el backend
import type { User, Trip, Reservation, Experience, Location } from '@/types'

// Obtener API URL de las variables de entorno
// Detecta automáticamente si está en localhost o en la red
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && envUrl !== 'undefined') {
    // Si la URL del env usa localhost pero estamos accediendo desde la red, usar la IP del servidor
    if (envUrl.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const serverIP = window.location.hostname
      return envUrl.replace('localhost', serverIP)
    }
    return envUrl
  }
  
  // Fallback: detectar automáticamente
  if (import.meta.env.DEV) {
    const hostname = window.location.hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3000/api'
    } else {
      // Estamos en la red, usar la IP del servidor
      return `http://${hostname}:3000/api`
    }
  }
  
  // Fallback para producción
  return '/api'
}

const API_URL = getApiUrl()

// Log para debugging (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('API URL:', API_URL)
  console.log('Frontend hostname:', window.location.hostname)
}

class ApiClient {
  private baseURL: string
  private token: string | null = null

  constructor(baseURL: string) {
    this.baseURL = baseURL
    this.loadToken()
  }

  private loadToken() {
    this.token = localStorage.getItem('token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    this.loadToken()
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error desconocido' }))
      throw new Error(error.message || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(name: string, email: string, password: string) {
    return this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
  }

  // Trips (Pasajeros)
  // Pricing
  async calculatePrice(distance: number, country: string, vehicleType?: string): Promise<{
    basePrice: number
    distancePrice: number
    timePrice: number
    totalPrice: number
    currency: string
  }> {
    return this.request('/pricing/calculate', {
      method: 'POST',
      body: JSON.stringify({ distance, country, vehicleType }),
    })
  }

  async getCountryCurrency(country: string): Promise<{ currency: string; country: string }> {
    return this.request(`/pricing/currency?country=${encodeURIComponent(country)}`)
  }

  async createTrip(tripData: {
    originAddress: string
    originLatitude: number
    originLongitude: number
    destinationAddress: string
    destinationLatitude: number
    destinationLongitude: number
    originPlaceId?: string
    destinationPlaceId?: string
    scheduledAt?: string
    returnScheduledAt?: string
    passengers?: number
    isRoundTrip?: boolean
    preferredVehicleType?: string
    distance: number
    duration: number
    distanceText: string
    durationText: string
    basePrice: number
    distancePrice: number
    timePrice: number
    totalPrice: number
    currency?: string
    routePolyline?: string
    routeBounds?: any
  }) {
    return this.request<Trip>('/trips', {
      method: 'POST',
      body: JSON.stringify(tripData),
    })
  }

  async getTrips(status?: string) {
    const params = status ? `?status=${status}` : ''
    return this.request<Trip[]>(`/trips${params}`)
  }

  async getTrip(id: string) {
    return this.request<Trip>(`/trips/${id}`)
  }

  async renewStartPin(tripId: string) {
    return this.request<{ startPin: string; startPinExpiresAt: string; startQrCode: string }>(`/trips/${tripId}/renew-pin`, {
      method: 'POST',
    })
  }

  async cancelTrip(id: string, reason?: string) {
    return this.request<Trip>(`/trips/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  }

  async cancelDriverTrip(id: string, reason?: string) {
    return this.request<Trip>(`/driver/trips/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  }

  // Experiences (Experiencias)
  async getExperiences(filters?: { status?: string; hostId?: string }) {
    const params = new URLSearchParams()
    if (filters?.status) params.append('status', filters.status)
    if (filters?.hostId) params.append('hostId', filters.hostId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request<Experience[]>(`/experiences${query}`)
  }

  async getExperience(id: string) {
    return this.request<Experience>(`/experiences/${id}`)
  }

  // Reservations
  async createReservation(reservationData: {
    experienceId: string
    startDate: string
    endDate: string
    participants: number
  }) {
    return this.request<Reservation>('/reservations', {
      method: 'POST',
      body: JSON.stringify(reservationData),
    })
  }

  async getReservations(status?: string) {
    const params = status ? `?status=${status}` : ''
    return this.request<Reservation[]>(`/reservations${params}`)
  }

  // Locations (Favoritos)
  async getSavedLocations() {
    return this.request<Location[]>('/locations')
  }

  async saveLocation(locationData: {
    name: string
    address: string
    latitude: number
    longitude: number
    placeId?: string
  }) {
    return this.request<Location>('/locations', {
      method: 'POST',
      body: JSON.stringify(locationData),
    })
  }

  async deleteLocation(id: string) {
    return this.request<void>(`/locations/${id}`, {
      method: 'DELETE',
    })
  }

  // Admin
  async getAdminStats() {
    return this.request<{
      totalUsers: number
      activeUsers: number
      totalTrips: number
      activeTrips: number
      completedTrips: number
      pendingTrips: number
      cancelledTrips: number
      inProgressTrips: number
      totalRevenue: number
      currency: string
      usersByRole: { role: string; count: number }[]
      tripsByStatus: { status: string; count: number }[]
      recentUsers: number
      recentTrips: number
    }>('/admin/stats')
  }

  // Admin - Users
  async getUsers(options?: {
    page?: number
    limit?: number
    role?: string
    isActive?: boolean
    search?: string
  }) {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.role) params.append('role', options.role)
    if (options?.isActive !== undefined) params.append('isActive', options.isActive.toString())
    if (options?.search) params.append('search', options.search)
    const query = params.toString() ? `?${params.toString()}` : ''
    return this.request<{
      users: User[]
      total: number
      page: number
      limit: number
      totalPages: number
    }>(`/admin/users${query}`)
  }

  async getUser(id: string) {
    return this.request<User>(`/admin/users/${id}`)
  }

  async createUser(userData: {
    email: string
    name: string
    phone?: string
    password?: string
    role?: string
    preferredCurrency?: string
    avatar?: string
  }) {
    return this.request<User>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async updateUser(id: string, userData: {
    name?: string
    phone?: string
    role?: string
    preferredCurrency?: string
    isActive?: boolean
    isVerified?: boolean
    isEmailVerified?: boolean
    avatar?: string
    password?: string
  }) {
    return this.request<User>(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    })
  }

  async deleteUser(id: string) {
    return this.request<{ message: string }>(`/admin/users/${id}`, {
      method: 'DELETE',
    })
  }

  async changeUserRole(id: string, role: string) {
    return this.request<User>(`/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
  }

  async toggleUserStatus(id: string, isActive: boolean) {
    return this.request<User>(`/admin/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    })
  }

  // Gestión de roles múltiples
  async getUserRoles(userId: string) {
    return this.request<{ roles: string[] }>(`/admin/users/${userId}/roles`)
  }

  async addUserRole(userId: string, role: string) {
    return this.request<{ message: string; roles: string[] }>(`/admin/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    })
  }

  async removeUserRole(userId: string, role: string) {
    return this.request<{ message: string; roles: string[] }>(`/admin/users/${userId}/roles/${role}`, {
      method: 'DELETE',
    })
  }

  async setUserRoles(userId: string, roles: string[]) {
    return this.request<{ message: string; roles: string[] }>(`/admin/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roles }),
    })
  }

  /**
   * Obtiene la información del usuario autenticado
   */
  async getProfile() {
    return this.request<{ user: User }>('/auth/me').then(res => res.user)
  }

  /**
   * Actualiza la información del usuario autenticado
   */
  async changeActiveRole(role: string) {
    return this.request<{ user: User }>('/auth/me/active-role', {
      method: 'PATCH',
      body: JSON.stringify({ role })
    })
  }

  async updateProfile(userData: {
    name?: string
    phone?: string
    preferredCurrency?: string
    country?: string
    avatar?: string
    stellarAddress?: string
  }) {
    return this.request<{ user: User }>('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(userData),
    }).then(res => res.user)
  }

  // Admin - Trips
  async getAdminTrips(options?: {
    page?: number
    limit?: number
    status?: string
    passengerId?: string
    driverId?: string
    search?: string
    startDate?: string
    endDate?: string
  }) {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.status) params.append('status', options.status)
    if (options?.passengerId) params.append('passengerId', options.passengerId)
    if (options?.driverId) params.append('driverId', options.driverId)
    if (options?.search) params.append('search', options.search)
    if (options?.startDate) params.append('startDate', options.startDate)
    if (options?.endDate) params.append('endDate', options.endDate)

    const queryString = params.toString()
    return this.request<{
      trips: Trip[]
      total: number
      page: number
      limit: number
      totalPages: number
    }>(`/admin/trips${queryString ? `?${queryString}` : ''}`)
  }

  async getAdminTrip(id: string) {
    return this.request<Trip>(`/admin/trips/${id}`)
  }

  async updateTripStatus(id: string, status: string) {
    return this.request<Trip>(`/admin/trips/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async assignDriverToTrip(id: string, driverId: string, vehicleId?: string, allowReassign: boolean = false) {
    const params = allowReassign ? '?allowReassign=true' : ''
    return this.request<Trip>(`/admin/trips/${id}/assign-driver${params}`, {
      method: 'PATCH',
      body: JSON.stringify({ driverId, vehicleId }),
    })
  }

  async cancelAdminTrip(id: string, reason?: string) {
    return this.request<Trip>(`/admin/trips/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  }

  async getAvailableDrivers(tripCountry?: string) {
    const params = tripCountry ? `?country=${encodeURIComponent(tripCountry)}` : ''
    return this.request<Array<{
      id: string
      name: string
      email: string
      phone?: string | null
      avatar?: string | null
      vehicles: Array<{
        id: string
        make: string
        model: string
        licensePlate: string
        type: string
      }>
    }>>(`/admin/drivers${params}`)
  }

  async getDriverVehicles(driverId: string) {
    return this.request<Array<{
      id: string
      make: string
      model: string
      year: number
      licensePlate: string
      color?: string | null
      type: string
      capacity: number
    }>>(`/admin/drivers/${driverId}/vehicles`)
  }

  // Métodos para conductores
  async getAvailableTrips(options?: {
    page?: number
    limit?: number
    vehicleType?: string
    maxDistance?: number
  }) {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.vehicleType) params.append('vehicleType', options.vehicleType)
    if (options?.maxDistance) params.append('maxDistance', options.maxDistance.toString())

    const queryString = params.toString()
    return this.request<{
      trips: Trip[]
      total: number
      page: number
      limit: number
      totalPages: number
    }>(`/driver/trips/available${queryString ? `?${queryString}` : ''}`)
  }

  async getDriverTrips(options?: {
    page?: number
    limit?: number
    status?: string | string[]
  }) {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      statuses.forEach(s => params.append('status', s))
    }

    const queryString = params.toString()
    return this.request<{
      trips: Trip[]
      total: number
      page: number
      limit: number
      totalPages: number
    }>(`/driver/trips${queryString ? `?${queryString}` : ''}`)
  }

  async getDriverTrip(tripId: string) {
    return this.request<Trip>(`/driver/trips/${tripId}`)
  }

  async acceptTrip(tripId: string, vehicleId?: string) {
    return this.request<Trip>(`/driver/trips/${tripId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId }),
    })
  }

  async rejectTrip(tripId: string, reason?: string) {
    return this.request<{ success: boolean }>(`/driver/trips/${tripId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async startTrip(tripId: string, options: {
    pin?: string
    qrCode?: string
    driverLatitude?: number
    driverLongitude?: number
  }) {
    return this.request<Trip>(`/driver/trips/${tripId}/start`, {
      method: 'POST',
      body: JSON.stringify(options),
    })
  }

  async completeTrip(tripId: string, options?: {
    driverLatitude?: number
    driverLongitude?: number
  }) {
    return this.request<Trip>(`/driver/trips/${tripId}/complete`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    })
  }

  // Pagos Stellar
  async getTripPaymentInfo(tripId: string) {
    return this.request<{
      trip: {
        id: string
        tripNumber: string
        totalPrice: number
        currency: string
        paymentQrCode?: string
        paymentAddress?: string
        paymentExpiresAt?: string
        status: string
        completedAt?: string
        transactionXdr?: string
      }
      payment: {
        id: string
        amount: number
        currency: string
        status: string
        paymentMethodDetails?: any
      } | null
    }>(`/payments/trip/${tripId}`)
  }

  async verifyStellarPayment(paymentId: string, transactionId: string) {
    return this.request<{
      payment: any
      verified: boolean
      message: string
    }>(`/payments/${paymentId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ transactionId }),
    })
  }

  // Notificaciones
  async getNotifications(options?: {
    page?: number
    limit?: number
    status?: string
    type?: string
  }) {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.status) params.append('status', options.status)
    if (options?.type) params.append('type', options.type)

    const queryString = params.toString()
    return this.request<{
      notifications: Array<{
        id: string
        type: string
        title: string
        message: string
        priority: string
        status: string
        data?: any
        actionUrl?: string
        actionLabel?: string
        createdAt: string
        readAt?: string
      }>
      total: number
      page: number
      limit: number
      totalPages: number
    }>(`/notifications${queryString ? `?${queryString}` : ''}`)
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>('/notifications/unread-count')
  }

  async markNotificationAsRead(notificationId: string) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    })
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', {
      method: 'PATCH',
    })
  }

  async archiveNotification(notificationId: string) {
    return this.request(`/notifications/${notificationId}/archive`, {
      method: 'PATCH',
    })
  }

  // Alertas para conductores
  async getDriverAlerts(options?: {
    status?: string
    includeExpired?: boolean
  }) {
    const params = new URLSearchParams()
    if (options?.status) params.append('status', options.status)
    if (options?.includeExpired) params.append('includeExpired', 'true')

    const queryString = params.toString()
    return this.request<{
      alerts: Array<{
        id: string
        tripId: string
        status: string
        expiresAt: string
        acceptedAt?: string
        rejectedAt?: string
        viewedAt?: string
        createdAt: string
        trip: Trip
      }>
    }>(`/driver/alerts${queryString ? `?${queryString}` : ''}`)
  }

  async acceptTripFromAlert(alertId: string, vehicleId?: string) {
    return this.request<{ success: boolean; trip: Trip }>(`/driver/alerts/${alertId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId }),
    })
  }

  async rejectTripFromAlert(alertId: string, reason?: string) {
    return this.request<{ success: boolean }>(`/driver/alerts/${alertId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  async markAlertAsViewed(alertId: string) {
    return this.request(`/driver/alerts/${alertId}/view`, {
      method: 'PATCH',
    })
  }

  // Gestión de vehículos del conductor
  async getMyVehicles() {
    return this.request<Array<import('@/types').Vehicle>>('/driver/vehicles')
  }

  async getMyVehicle(vehicleId: string) {
    return this.request<import('@/types').Vehicle>(`/driver/vehicles/${vehicleId}`)
  }

  async createVehicle(data: {
    make: string
    model: string
    year: number
    color?: string
    licensePlate: string
    type: string
    capacity: number
    photos?: string[]
  }) {
    return this.request<import('@/types').Vehicle>('/driver/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateVehicle(vehicleId: string, data: {
    make?: string
    model?: string
    year?: number
    color?: string
    licensePlate?: string
    type?: string
    capacity?: number
    isAvailable?: boolean
    photos?: string[]
  }) {
    return this.request<import('@/types').Vehicle>(`/driver/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async deleteVehicle(vehicleId: string) {
    return this.request(`/driver/vehicles/${vehicleId}`, {
      method: 'DELETE',
    })
  }

  // Gestión de vehículos para administradores
  async getAdminVehicles(options?: {
    page?: number
    limit?: number
    approvalStatus?: string
    driverId?: string
  }) {
    const params = new URLSearchParams()
    if (options?.page) params.append('page', options.page.toString())
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.approvalStatus) params.append('approvalStatus', options.approvalStatus)
    if (options?.driverId) params.append('driverId', options.driverId)

    const queryString = params.toString()
    return this.request<{
      vehicles: Array<import('@/types').Vehicle>
      total: number
      page: number
      limit: number
      totalPages: number
    }>(`/admin/vehicles${queryString ? `?${queryString}` : ''}`)
  }

  async getAdminVehicle(vehicleId: string) {
    return this.request<import('@/types').Vehicle>(`/admin/vehicles/${vehicleId}`)
  }

  async approveVehicle(vehicleId: string) {
    return this.request<import('@/types').Vehicle>(`/admin/vehicles/${vehicleId}/approve`, {
      method: 'POST',
    })
  }

  async rejectVehicle(vehicleId: string, reason?: string) {
    return this.request<import('@/types').Vehicle>(`/admin/vehicles/${vehicleId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  // Onboarding de conductores
  async getOnboardingStatus() {
    return this.request<import('@/types').DriverOnboarding>('/onboarding')
  }

  async startOnboarding(data: {
    fullName?: string
    dateOfBirth?: string
    nationalId?: string
    address?: string
    city?: string
    country?: string
  }) {
    return this.request<import('@/types').DriverOnboarding>('/onboarding/start', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateOnboarding(data: {
    fullName?: string
    dateOfBirth?: string
    nationalId?: string
    address?: string
    city?: string
    country?: string
    licenseNumber?: string
    licenseExpiryDate?: string
    licenseIssuedBy?: string
    bankName?: string
    accountNumber?: string
    accountType?: string
    routingNumber?: string
    currentStep?: number
  }) {
    return this.request<import('@/types').DriverOnboarding>('/onboarding', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async uploadDocument(data: {
    type: string
    fileName: string
    fileUrl: string
    fileSize?: number
    mimeType?: string
  }) {
    return this.request<import('@/types').DriverDocument>('/onboarding/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteDocument(documentId: string) {
    return this.request(`/onboarding/documents/${documentId}`, {
      method: 'DELETE',
    })
  }

  async linkVehicleToOnboarding(vehicleId: string) {
    return this.request<import('@/types').DriverOnboarding>('/onboarding/vehicle', {
      method: 'POST',
      body: JSON.stringify({ vehicleId }),
    })
  }

  async completeOnboarding() {
    return this.request<import('@/types').DriverOnboarding>('/onboarding/complete', {
      method: 'POST',
    })
  }

  async uploadFile(file: File, folder?: string): Promise<{ url: string; fileName: string; fileSize: number; mimeType: string }> {
    this.loadToken()
    
    const formData = new FormData()
    formData.append('file', file)
    if (folder) {
      formData.append('folder', folder)
    }

    const headers: Record<string, string> = {}
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(`${this.baseURL}/upload`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error desconocido' }))
      throw new Error(error.message || `HTTP error! status: ${response.status}`)
    }

    return response.json()
  }

  // Onboarding para administradores
  async getPendingOnboardings() {
    return this.request<Array<import('@/types').DriverOnboarding>>('/onboarding/pending')
  }

  async approveOnboarding(onboardingId: string) {
    return this.request<import('@/types').DriverOnboarding>(`/onboarding/${onboardingId}/approve`, {
      method: 'POST',
    })
  }

  async rejectOnboarding(onboardingId: string, reason: string) {
    return this.request<import('@/types').DriverOnboarding>(`/onboarding/${onboardingId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  // Wallet Mobile Connection
  async generateConnectionQR() {
    return this.request<{
      qrCode: string
      connectionUrl: string
      token: string
      expiresAt: string
    }>('/wallet/generate-connection-qr', {
      method: 'POST',
    })
  }

  async verifyMobileConnection(token: string, stellarAddress: string) {
    return this.request<{
      success: boolean
      message: string
      user: User
    }>(`/wallet/verify-connection/${token}`, {
      method: 'POST',
      body: JSON.stringify({ stellarAddress }),
    })
  }

  async getWalletConnectionStatus() {
    return this.request<{
      isConnected: boolean
      stellarAddress: string | null
    }>('/wallet/connection-status')
  }
}

export const api = new ApiClient(API_URL)

