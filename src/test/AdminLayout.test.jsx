import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdminLayout from '../pages/Admin/AdminLayout';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../pages/Admin/AdminDashboard', () => ({ default: () => <div>Vista dashboard</div> }));
vi.mock('../pages/Admin/AdminOrdenes', () => ({ default: () => <div>Vista ordenes</div> }));
vi.mock('../pages/Admin/AdminProductos', () => ({ default: () => <div>Vista productos</div> }));
vi.mock('../pages/Admin/AdminCategorias', () => ({ default: () => <div>Vista categorias</div> }));
vi.mock('../pages/Admin/AdminBlogs', () => ({ default: () => <div>Vista blogs</div> }));
vi.mock('../pages/Admin/AdminReportes', () => ({ default: () => <div>Vista reportes</div> }));
vi.mock('../pages/Admin/AdminUsuarios', () => ({ default: () => <div>Vista usuarios</div> }));

import { useAuth } from '../context/AuthContext';

function renderLayout(perfil = { nombre: 'Ana', tipo: 'Administrador' }, signOut = vi.fn()) {
  useAuth.mockReturnValue({ perfil, signOut });
  render(
    <MemoryRouter>
      <AdminLayout />
    </MemoryRouter>
  );
  return { signOut, user: userEvent.setup() };
}

describe('AdminLayout', () => {
  it('abre en el dashboard y muestra el perfil', () => {
    renderLayout();
    expect(screen.getByText('Vista dashboard')).toBeInTheDocument();
    expect(screen.getByText('Ana · Administrador')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'Salir a Tienda' })).toHaveAttribute('href', '/');
  });

  it('un administrador ve Reportes y Usuarios', () => {
    renderLayout();
    expect(screen.getByRole('link', { name: 'Reportes' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
  });

  it('un vendedor no ve Reportes ni Usuarios', () => {
    renderLayout({ nombre: 'Leo', tipo: 'Vendedor' });
    expect(screen.queryByRole('link', { name: 'Reportes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.getByText('Leo · Vendedor')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Órdenes' })).toBeInTheDocument();
  });

  it('cambiar de sección muestra solo esa vista', async () => {
    const { user } = renderLayout();
    await user.click(screen.getByRole('link', { name: 'Productos' }));
    expect(screen.getByText('Vista productos')).toBeInTheDocument();
    expect(screen.queryByText('Vista dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Productos' })).toHaveClass('active');
    await user.click(screen.getByRole('link', { name: 'Usuarios' }));
    expect(screen.getByText('Vista usuarios')).toBeInTheDocument();
  });

  it('sin perfil muestra "Cargando..."', () => {
    renderLayout(null);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('"Salir" llama a signOut', async () => {
    const { user, signOut } = renderLayout();
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Órdenes', 'Vista ordenes'],
    ['Categorías', 'Vista categorias'],
    ['Blogs', 'Vista blogs'],
    ['Reportes', 'Vista reportes'],
  ])('la sección %s muestra su vista', async (enlace, vista) => {
    const { user } = renderLayout();
    await user.click(screen.getByRole('link', { name: enlace }));
    expect(screen.getByText(vista)).toBeInTheDocument();
    expect(screen.queryByText('Vista dashboard')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: enlace })).toHaveClass('active');
  });
});
