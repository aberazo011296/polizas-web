import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/ui/Layout'
import { ToastContainer } from './components/ui/Toast'
import HomePage from './pages/HomePage'
import PlantillasPage from './pages/PlantillasPage'
import NuevaPlantillaPage from './pages/NuevaPlantillaPage'
import ProcesarPage from './pages/ProcesarPage'
import EditarTemplatePage from './pages/EditarTemplatePage'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/plantillas" element={<PlantillasPage />} />
          <Route path="/plantillas/nueva" element={<NuevaPlantillaPage />} />
          <Route path="/plantillas/editar" element={<NuevaPlantillaPage />} />
          <Route path="/procesar" element={<ProcesarPage />} />
          <Route path="/plantillas/template" element={<EditarTemplatePage />} />
        </Routes>
      </Layout>
      <ToastContainer />
    </BrowserRouter>
  )
}
