import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../context/AuthContext';

function renderRuta() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<ProtectedRoute><p>Panel admin</p></ProtectedRoute>} />
        <Route path="/iniciar-sesion" element={<p>Pantalla login</p>} />
        <Route path="/" element={<p>Pantalla home</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('mientras carga la sesión muestra "Cargando..."', () => {
    useAuth.mockReturnValue({ usuario: null, loading: true, esAdminOVendedor: false });
    renderRuta();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText('Panel admin')).not.toBeInTheDocument();
  });

  it('sin sesión redirige a /iniciar-sesion', () => {
    useAuth.mockReturnValue({ usuario: null, loading: false, esAdminOVendedor: false });
    renderRuta();
    expect(screen.getByText('Pantalla login')).toBeInTheDocument();
  });

  it('con sesión de cliente (no admin ni vendedor) redirige al home', () => {
    useAuth.mockReturnValue({ usuario: { id: 'u1' }, loading: false, esAdminOVendedor: false });
    renderRuta();
    expect(screen.getByText('Pantalla home')).toBeInTheDocument();
    expect(screen.queryByText('Panel admin')).not.toBeInTheDocument();
  });

  it('con sesión de administrador o vendedor muestra el contenido', () => {
    useAuth.mockReturnValue({ usuario: { id: 'u1' }, loading: false, esAdminOVendedor: true });
    renderRuta();
    expect(screen.getByText('Panel admin')).toBeInTheDocument();
  });
});
