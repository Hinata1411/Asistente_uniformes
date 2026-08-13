import { createContext, useContext, useEffect, useState } from 'react'
import { auth, db } from '../firebase/config'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setLoading(true)
        setUser(currentUser)

        if (!currentUser) {
          setRole(null)
          return
        }

        console.log('UID usuario autenticado:', currentUser.uid)

        const userRef = doc(db, 'users', currentUser.uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const userData = userSnap.data()

          console.log('Datos encontrados en Firestore:', userData)
          console.log('Rol encontrado:', userData.role)

          setRole(userData.role || null)
        } else {
          console.warn(
            'No existe documento users con UID:',
            currentUser.uid
          )

          setRole(null)
        }
      } catch (error) {
        console.error(
          'Error obteniendo usuario desde Firestore:',
          error
        )

        setRole(null)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}