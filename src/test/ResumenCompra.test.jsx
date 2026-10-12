import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResumenCompra from '../pages/ResumenCompra';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));

// Solo se usa al recargar la página: busca la orden y sus items.
const mocks = vi.hoisted(() => ({ orden: { data: null }, items: { data: [] } }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: (tabla) =>
      tabla === 'ordenes'
        ? { select: () => ({ eq: () => ({ single: () => Promise.resolve(mocks.orden) }) }) }
        : { select: () => ({ eq: () => Promise.resolve(mocks.items) }) },
  },
}));

import { useAuth } from '../context/AuthContext';

const comprador = {
  nombre: 'Ana',
  apellidos: 'Pérez',
  correo: 'ana@gmail.com',
  region: 'Arica y Parinacota',
  comuna: 'Arica',
  direccion: 'Calle 123',
};

const compraExitosa = {
  exito: true,
  ordenId: 'ord-1',
  total: 20000,
  items: [{ nombre: 'Mouse', cantidad: 2, precio: 10000 }],
  comprador,
};

function renderResumen({ ruta = '/resumen-compra', state, usuario = { id: 'u1' } } = {}) {
  useAuth.mockReturnValue({ usuario });
  render(
    <MemoryRouter initialEntries={[{ pathname: ruta, state }]}>
      <Routes>
        <Route path="/resumen-compra" element={<ResumenCompra />} />
        <Route path="/resumen-compra/:ordenId" element={<ResumenCompra />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResumenCompra', () => {
  describe('con los datos que llegan desde el checkout', () => {
    it('compra exitosa: muestra pedido, productos, total y datos de envío', () => {
      renderResumen({ ruta: '/resumen-compra/ord-1', state: compraExitosa });
      expect(screen.getByText(/Pago exitoso/)).toBeInTheDocument();
      expect(screen.getByText('Número de pedido: #ord-1')).toBeInTheDocument();
      expect(screen.getByText('Mouse')).toBeInTheDocument();
      expect(screen.getByText('x2')).toBeInTheDocument();
      expect(screen.getAllByText('$20.000')).toHaveLength(2); // subtotal del producto y total pagado
      expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
      expect(screen.getByText('ana@gmail.com')).toBeInTheDocument();
      expect(screen.getByText('Calle 123, Arica, Arica y Parinacota')).toBeInTheDocument();
    });

    it('compra exitosa: "Seguir comprando" lleva a /productos', () => {
      renderResumen({ state: compraExitosa });
      expect(screen.getByRole('link', { name: 'Seguir comprando' })).toHaveAttribute('href', '/productos');
    });

    it('compra fallida: muestra el motivo y permite volver al carrito', () => {
      renderResumen({ state: { exito: false, motivo: 'Stock insuficiente' } });
      expect(screen.getByText(/No se pudo procesar el pago/)).toBeInTheDocument();
      expect(screen.getByText('Stock insuficiente')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver al carrito' })).toHaveAttribute('href', '/carrito');
      expect(screen.queryByText(/Número de pedido/)).not.toBeInTheDocument();
    });

    it('compra fallida sin motivo muestra un mensaje genérico', () => {
      renderResumen({ state: { exito: false } });
      expect(screen.getByText('Ocurrió un error inesperado.')).toBeInTheDocument();
    });
  });

  describe('sin datos (página recargada)', () => {
    it('sin número de orden avisa que no hay información y ofrece volver al inicio', () => {
      renderResumen();
      expect(screen.getByText(/No encontramos información de esta compra/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
    });

    it('con sesión recupera la orden exitosa desde Supabase', async () => {
      mocks.orden = {
        data: { id: 'ord-9', estado: 'exitosa', total: 30000, nombre_comprador: 'Luis', apellidos_comprador: 'Díaz',
          correo_comprador: 'luis@gmail.com', region: 'Tarapacá', comuna: 'Iquique', direccion: 'Prat 10' },
      };
      mocks.items = { data: [{ nombre_producto: 'Teclado', cantidad: 1, precio_unitario: 30000 }] };
      renderResumen({ ruta: '/resumen-compra/ord-9' });
      expect(screen.getByText('Cargando resumen...')).toBeInTheDocument();
      expect(await screen.findByText(/Pago exitoso/)).toBeInTheDocument();
      expect(screen.getByText('Número de pedido: #ord-9')).toBeInTheDocument();
      expect(screen.getByText('Teclado')).toBeInTheDocument();
      expect(screen.getByText('Luis Díaz')).toBeInTheDocument();
    });

    it('con sesión recupera una orden fallida y la muestra como fallida', async () => {
      mocks.orden = { data: { id: 'ord-10', estado: 'fallida', total: 5000 } };
      mocks.items = { data: [] };
      renderResumen({ ruta: '/resumen-compra/ord-10' });
      expect(await screen.findByText(/No se pudo procesar el pago/)).toBeInTheDocument();
    });

    it('si la orden no existe avisa que no hay información', async () => {
      mocks.orden = { data: null };
      renderResumen({ ruta: '/resumen-compra/ord-404' });
      expect(await screen.findByText(/No encontramos información de esta compra/)).toBeInTheDocument();
    });

    it('sin sesión no consulta la orden y avisa que no hay información', async () => {
      mocks.orden = { data: { id: 'ord-9', estado: 'exitosa', total: 1 } };
      renderResumen({ ruta: '/resumen-compra/ord-9', usuario: null });
      expect(await screen.findByText(/No encontramos información de esta compra/)).toBeInTheDocument();
    });
  });

  describe('datos incompletos', () => {
    it('al recuperar una orden sin lista de items muestra la compra sin productos', async () => {
      mocks.orden = { data: { id: 'ord-11', estado: 'exitosa', total: 1000, nombre_comprador: 'Eva', apellidos_comprador: 'Rojas' } };
      mocks.items = { data: null };
      renderResumen({ ruta: '/resumen-compra/ord-11' });
      expect(await screen.findByText(/Pago exitoso/)).toBeInTheDocument();
      expect(screen.getByText('Número de pedido: #ord-11')).toBeInTheDocument();
      expect(screen.queryByText(/^x\d+$/)).not.toBeInTheDocument();
    });

    it('una compra exitosa que llega sin items no muestra productos', () => {
      renderResumen({ state: { exito: true, ordenId: 'ord-12', total: 1000, comprador } });
      expect(screen.getByText(/Pago exitoso/)).toBeInTheDocument();
      expect(screen.queryByText(/^x\d+$/)).not.toBeInTheDocument();
    });
  });
});
