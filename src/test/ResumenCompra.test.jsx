import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResumenCompra from '../pages/ResumenCompra';
import { cadena } from '../test/cadenaSupabase';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

import { useAuth } from '../context/AuthContext';

const exito = {
  exito: true,
  ordenId: 'ord-1',
  total: 20000,
  items: [{ nombre: 'Mouse', cantidad: 2, precio: 10000 }],
  comprador: {
    nombre: 'Ana',
    apellidos: 'Pérez',
    correo: 'ana@gmail.com',
    region: 'Arica y Parinacota',
    comuna: 'Arica',
    direccion: 'Calle 123',
  },
};

function renderResumen(entry, usuario = null) {
  useAuth.mockReturnValue({ usuario });
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/resumen-compra/:ordenId" element={<ResumenCompra />} />
        <Route path="/resumen-compra" element={<ResumenCompra />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResumenCompra', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation((tabla) => {
      if (tabla === 'ordenes') {
        return cadena(() => ({
          data: {
            id: 'ord-7',
            estado: 'exitosa',
            total: 15000,
            nombre_comprador: 'Luis',
            apellidos_comprador: 'Díaz',
            correo_comprador: 'luis@gmail.com',
            region: 'Tarapacá',
            comuna: 'Iquique',
            direccion: 'Arturo Prat 10',
          },
        }));
      }
      return cadena(() => ({
        data: [{ nombre_producto: 'Teclado', cantidad: 1, precio_unitario: 15000 }],
      }));
    });
  });

  it('con un pago exitoso muestra productos, total y envío', () => {
    renderResumen({ pathname: '/resumen-compra/ord-1', state: exito });
    expect(screen.getByText(/¡Pago exitoso! Tu pedido fue confirmado/)).toBeInTheDocument();
    expect(screen.getByText('Número de pedido: #ord-1')).toBeInTheDocument();
    expect(screen.getByText('Mouse')).toBeInTheDocument();
    expect(screen.getAllByText('$20.000')).toHaveLength(2);
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Calle 123, Arica, Arica y Parinacota')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/productos');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('con un pago fallido muestra el motivo y vuelve al carrito', () => {
    renderResumen({
      pathname: '/resumen-compra',
      state: { exito: false, motivo: 'Sin stock', ordenId: null },
    });
    expect(screen.getByText('No se pudo procesar el pago.')).toBeInTheDocument();
    expect(screen.getByText('Sin stock')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al carrito' })).toHaveAttribute('href', '/carrito');
  });

  it('sin motivo usa el texto de error genérico', () => {
    renderResumen({ pathname: '/resumen-compra', state: { exito: false } });
    expect(screen.getByText('Ocurrió un error inesperado.')).toBeInTheDocument();
  });

  it('sin state ni id de orden explica que no hay información', () => {
    renderResumen('/resumen-compra');
    expect(screen.getByText(/No encontramos información de esta compra/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });

  it('recarga la orden desde Supabase cuando hay sesión y un id', async () => {
    renderResumen('/resumen-compra/ord-7', { id: 'u1' });
    expect(screen.getByText('Cargando resumen...')).toBeInTheDocument();
    expect(await screen.findByText(/¡Pago exitoso!/)).toBeInTheDocument();
    expect(screen.getByText('Número de pedido: #ord-7')).toBeInTheDocument();
    expect(screen.getByText('Teclado')).toBeInTheDocument();
    expect(screen.getByText('Luis Díaz')).toBeInTheDocument();
    expect(screen.getAllByText('$15.000')).toHaveLength(2);
  });

  it('un invitado con id de orden no consulta Supabase', async () => {
    renderResumen('/resumen-compra/ord-7', null);
    expect(await screen.findByText(/No encontramos información de esta compra/)).toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('si la orden no existe muestra el aviso de información faltante', async () => {
    mocks.from.mockImplementation(() => cadena(() => ({ data: null })));
    renderResumen('/resumen-compra/ord-7', { id: 'u1' });
    expect(await screen.findByText(/No encontramos información de esta compra/)).toBeInTheDocument();
  });
});
