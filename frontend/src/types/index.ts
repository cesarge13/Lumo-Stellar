// Tipos compartidos basados en el schema de Prisma
// Estos tipos deben mantenerse sincronizados con el backend

export const enum UserRole {
  PASSENGER = 'PASSENGER',
  DRIVER = 'DRIVER',
  HOST = 'HOST',
  DISPATCHER = 'DISPATCHER',
  SUPPORT = 'SUPPORT',
  MODERATOR = 'MODERATOR',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR', // @deprecated
}

export const enum Currency {
  CLP = 'CLP',
  MXN = 'MXN',
  USD = 'USD',
  ARS = 'ARS',
  COP = 'COP',
  BRL = 'BRL',
  BOB = 'BOB',
  PEN = 'PEN',
  CAD = 'CAD',
}

export const enum TripStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export const enum VehicleType {
  SEDAN = 'SEDAN',
  SUV = 'SUV',
  VAN = 'VAN',
  PICKUP = 'PICKUP',
  OFF_ROAD = 'OFF_ROAD',
  LUXURY = 'LUXURY',
  MOTORCYCLE = 'MOTORCYCLE',
  OTHER = 'OTHER',
}

export const enum VehicleApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export const enum DriverOnboardingStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

export const enum DriverDocumentType {
  NATIONAL_ID_FRONT = 'NATIONAL_ID_FRONT',
  NATIONAL_ID_BACK = 'NATIONAL_ID_BACK',
  DRIVER_LICENSE_FRONT = 'DRIVER_LICENSE_FRONT',
  DRIVER_LICENSE_BACK = 'DRIVER_LICENSE_BACK',
  PROOF_OF_ADDRESS = 'PROOF_OF_ADDRESS',
  BANK_STATEMENT = 'BANK_STATEMENT',
  VEHICLE_REGISTRATION = 'VEHICLE_REGISTRATION',
  VEHICLE_INSURANCE = 'VEHICLE_INSURANCE',
  CRIMINAL_RECORD = 'CRIMINAL_RECORD',
  OTHER = 'OTHER',
}

export const enum DocumentStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

export const enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export const enum ExperienceStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export const enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export const enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  CASH = 'CASH',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
}

export const enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

export const enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export const enum DriverAlertStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  data?: any
  priority: NotificationPriority
  status: NotificationStatus
  channels: string[]
  readAt?: string | null
  archivedAt?: string | null
  expiresAt?: string | null
  actionUrl?: string | null
  actionLabel?: string | null
  metadata?: any
  createdAt: string
  updatedAt: string
}

export interface DriverAlert {
  id: string
  driverId: string
  tripId: string
  status: DriverAlertStatus
  expiresAt: string
  acceptedAt?: string | null
  rejectedAt?: string | null
  viewedAt?: string | null
  metadata?: any
  createdAt: string
  updatedAt: string
  trip: Trip
}

export interface User {
  id: string
  email: string
  name: string
  phone?: string | null
  role: UserRole // Rol principal (para compatibilidad)
  activeRole?: UserRole // Rol activo actual
  roles?: UserRole[] // Todos los roles (principal + adicionales)
  preferredCurrency?: Currency
  country?: string | null
  stellarAddress?: string | null // Dirección Stellar para recibir pagos
  isActive: boolean
  isVerified: boolean
  isEmailVerified: boolean
  isRootAdmin?: boolean
  avatar?: string | null
  createdAt: string
  updatedAt: string
  userRoles?: Array<{ role: UserRole }> // Roles adicionales desde el backend
}

export interface Trip {
  id: string
  tripNumber: string
  passengerId?: string | null
  driverId?: string | null
  vehicleId?: string | null
  originAddress: string
  originLatitude: number
  originLongitude: number
  destinationAddress: string
  destinationLatitude: number
  destinationLongitude: number
  originPlaceId?: string | null
  destinationPlaceId?: string | null
  routeId?: string | null
  distance: number
  duration: number
  distanceText: string
  durationText: string
  passengers: number
  isRoundTrip?: boolean
  returnScheduledAt?: string | null
  preferredVehicleType?: VehicleType | null
  routePolyline?: string | null
  routeBounds?: any
  driverRequestedAt?: string | null
  acceptanceDeadline?: string | null
  driverAcceptedAt?: string | null
  driverRejectedAt?: string | null
  startPin?: string | null
  startPinExpiresAt?: string | null
  startQrCode?: string | null
  paymentQrCode?: string | null
  paymentAddress?: string | null
  paymentExpiresAt?: string | null
  stellarTransactionId?: string | null
  basePrice: number
  distancePrice: number
  timePrice: number
  totalPrice: number
  currency: string
  scheduledAt?: string | null
  startedAt?: string | null
  completedAt?: string | null
  status: TripStatus
  notes?: string | null
  createdAt: string
  updatedAt: string
  passenger?: User | null
  driver?: User | null
  vehicle?: Vehicle | null
  originPlace?: {
    id: string
    country?: string | null
    formattedAddress?: string | null
  } | null
  destinationPlace?: {
    id: string
    country?: string | null
    formattedAddress?: string | null
  } | null
}

export interface Vehicle {
  id: string
  userId: string
  make: string
  model: string
  year: number
  licensePlate: string
  color?: string | null
  type: VehicleType
  capacity: number
  isAvailable: boolean
  isVerified: boolean
  approvalStatus: VehicleApprovalStatus
  approvedAt?: string | null
  approvedBy?: string | null
  rejectionReason?: string | null
  photos?: string[]
  metadata?: any
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface Experience {
  id: string
  hostId: string
  vehicleId?: string | null
  title: string
  description?: string | null
  durationDays: number
  basePrice: number
  currency: string
  status: ExperienceStatus
  startPlaceId?: string | null
  endPlaceId?: string | null
  createdAt: string
  updatedAt: string
  host?: User | null
  vehicle?: Vehicle | null
}

export interface Reservation {
  id: string
  experienceId: string
  passengerId: string
  startDate: string
  endDate: string
  participants: number
  basePrice: number
  totalPrice: number
  currency: string
  status: ReservationStatus
  notes?: string | null
  passengerName: string
  passengerPhone: string
  passengerEmail?: string | null
  createdAt: string
  updatedAt: string
  experience?: Experience | null
  passenger?: User | null
}

export interface Location {
  id: string
  userId: string
  name: string
  address: string
  latitude: number
  longitude: number
  placeId?: string | null
  isFavorite: boolean
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  userId?: string | null
  tripId?: string | null
  reservationId?: string | null
  amount: number
  currency: string
  status: PaymentStatus
  method: PaymentMethod
  transactionId?: string | null
  createdAt: string
  updatedAt: string
}

export interface DriverDocument {
  id: string
  onboardingId: string
  type: DriverDocumentType
  fileName: string
  fileUrl: string
  fileSize?: number | null
  mimeType?: string | null
  status: DocumentStatus
  verifiedAt?: string | null
  verifiedBy?: string | null
  rejectionReason?: string | null
  metadata?: any
  createdAt: string
  updatedAt: string
}

export const enum DriverType {
  INDEPENDENT = 'INDEPENDENT',
  COMPANY = 'COMPANY',
}

export const enum TaxIdType {
  RUT = 'RUT',
  CUIT = 'CUIT',
  RFC = 'RFC',
  CPF = 'CPF',
  CNPJ = 'CNPJ',
  NIT = 'NIT',
  RUC = 'RUC',
  NIT_BOL = 'NIT_BOL',
  SIN = 'SIN',
  EIN = 'EIN',
  OTHER = 'OTHER',
}

export interface DriverOnboarding {
  id: string
  userId: string
  status: DriverOnboardingStatus
  currentStep: number
  totalSteps: number
  fullName?: string | null
  dateOfBirth?: string | null
  nationalId?: string | null
  address?: string | null
  city?: string | null
  country?: string | null
  driverType?: DriverType | null
  companyName?: string | null
  companyTaxId?: string | null
  companyAddress?: string | null
  companyCity?: string | null
  companyCountry?: string | null
  taxId?: string | null
  taxIdType?: TaxIdType | null
  licenseNumber?: string | null
  licenseExpiryDate?: string | null
  licenseIssuedBy?: string | null
  bankName?: string | null
  accountNumber?: string | null
  accountType?: string | null
  routingNumber?: string | null
  bankCountry?: string | null
  vehicleId?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  rejectionReason?: string | null
  notes?: string | null
  metadata?: any
  createdAt: string
  updatedAt: string
  documents?: DriverDocument[]
  vehicle?: Vehicle | null
  user?: {
    id: string
    email: string
    name: string
    phone?: string | null
  } | null
}

