import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { UserCircle, Save, ArrowLeft, Mail, Phone, MapPin, Headphones } from 'lucide-react'
import { api } from '@/services/api'
import { getCountryName } from '@/services/locationService'

export default function SupportProfile() {
  const { t } = useTranslation()
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
  })

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    loadRoleProfile()
  }, [user, navigate])

  const loadRoleProfile = async () => {
    try {
      if (user) {
        setFormData({
          displayName: user.name,
          bio: '',
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    try {
      setIsSaving(true)
      
      const updatedUser = await api.updateProfile({
        name: formData.displayName,
      })

      setUser(updatedUser)
      localStorage.setItem('user', JSON.stringify(updatedUser))

      toast.success(t('profile.saved') || 'Perfil guardado correctamente')
    } catch (error: any) {
      console.error('Error saving profile:', error)
      toast.error(error.message || t('profile.saveError') || 'Error al guardar perfil')
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) {
    return null
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back') || 'Volver'}
      </Button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <UserCircle className="h-8 w-8" />
          <h1 className="text-3xl font-bold">{t('profile.title') || 'Mi Perfil'}</h1>
        </div>
        <p className="text-muted-foreground">
          {t('profile.support.description') || 'Gestiona tu perfil de soporte'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Información del Perfil */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.personalInfo') || 'Información Personal'}</CardTitle>
              <CardDescription>
                {t('profile.personalInfoDescription') || 'Actualiza tu información de perfil'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <Badge variant="secondary" className="mt-1">
                    {t('roles.support') || 'Soporte'}
                  </Badge>
                </div>
              </div>

              <div>
                <Label htmlFor="displayName">{t('profile.displayName') || 'Nombre a mostrar'}</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder={t('profile.displayNamePlaceholder') || 'Tu nombre público'}
                />
              </div>

              <div>
                <Label htmlFor="bio">{t('profile.bio') || 'Biografía'}</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder={t('profile.bioPlaceholder') || 'Información sobre tu rol como agente de soporte...'}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Información de Contacto */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.contactInfo') || 'Información de Contacto'}</CardTitle>
              <CardDescription>
                {t('profile.contactInfoDescription') || 'Tu información de contacto'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="email">{t('auth.email') || 'Email'}</Label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              {user.phone && (
                <div>
                  <Label htmlFor="phone">{t('admin.phone') || 'Teléfono'}</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={user.phone}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              )}

              {user.country && (
                <div>
                  <Label htmlFor="country">{t('settings.country') || 'País'}</Label>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="country"
                      value={getCountryName(user.country)}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              {t('common.cancel') || 'Cancelar'}
            </Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? (t('common.saving') || 'Guardando...') : (t('common.save') || 'Guardar')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

