import { render, screen } from '@testing-library/react';
import Ofertas from '../pages/Ofertas';
import { cadena } from '../test/cadenaSupabase';

const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: (...args) => mocks.from(...args) },
}));

const ofertas = [
  { id: 1, nombre: 'Mouse Logitech', precio: 10000, descuento_porcentaje: 15 },
  { id: 2, nombre: 'Teclado Keychron', precio: 40000, descuento_porcentaje: 10 },
];

function renderOfertas(respuesta = { data: ofertas, error: null }) {
  mocks.from.mockImplementation(() => cadena(() => respuesta));
  render(<Ofertas />);
}

describe('Ofertas', () => {
  it('muestra "Cargando ofertas..." mientras espera', async () => {
    let resolver;
    mocks.from.mockImplementation(() => ({
      select: () => ({
        not: () => ({ order: () => new Promise((resolve) => { resolver = resolve; }) }),
      }),
    }));
    render(<Ofertas />);
    expect(screen.getByText('Cargando ofertas...')).toBeInTheDocument();
    resolver({ data: ofertas, error: null });
    expect(await screen.findByRole('heading', { name: 'Mouse Logitech' })).toBeInTheDocument();
    expect(screen.queryByText('Cargando ofertas...')).not.toBeInTheDocument();
  });

  it('renderiza una tarjeta por oferta', async () => {
    renderOfertas();
    expect(await screen.findByRole('heading', { name: 'Mouse Logitech' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Teclado Keychron' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 5 })).toHaveLength(2);
  });

  it('sin ofertas activas muestra el aviso', async () => {
    renderOfertas({ data: [], error: null });
    expect(await screen.findByText(/No hay ofertas activas en este momento/)).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 5 })).toHaveLength(0);
  });

  it('si Supabase devuelve error no muestra productos', async () => {
    renderOfertas({ data: [{ id: 1, nombre: 'Mouse Logitech' }], error: { message: 'falló' } });
    expect(await screen.findByText(/No hay ofertas activas en este momento/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Mouse Logitech' })).not.toBeInTheDocument();
  });
});
