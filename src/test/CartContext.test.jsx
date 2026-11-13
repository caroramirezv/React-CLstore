import { render, screen, act } from '@testing-library/react';
import Swal from 'sweetalert2';
import { CartProvider, useCart } from '../context/CartContext';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
const mocks = vi.hoisted(() => ({
  listar: vi.fn(),
  agregar: vi.fn(),
  cambiar: vi.fn(),
  quitar: vi.fn(),
  vaciar: vi.fn(),
}));
vi.mock('../api/carritoApi', () => ({
  listarCarrito: (...args) => mocks.listar(...args),
  agregarAlCarrito: (...args) => mocks.agregar(...args),
  cambiarCantidadCarrito: (...args) => mocks.cambiar(...args),
  quitarDelCarrito: (...args) => mocks.quitar(...args),
  vaciarCarritoRemoto: (...args) => mocks.vaciar(...args),
}));

import { useAuth } from '../context/AuthContext';

const mouse = { id: 'p1', nombre: 'Mouse', precio: 10000, imagen: 'm.jpg', descuento_porcentaje: null, stock: 5 };
const teclado = { id: 'p2', nombre: 'Teclado', precio: 20000, imagen: 't.jpg', descuento_porcentaje: 10, stock: 3 };
// Lo que devuelve ms-carrito: el carrito completo, con el producto embebido
const enApi = (...lineas) => lineas.map(([producto, cantidad], i) => ({ id: i + 1, producto_id: producto.id, cantidad, productos: producto }));

let carro;
function Sonda() {
  carro = useCart();
  return <p data-testid="resumen">{carro.items.map((it) => `${it.producto_id}x${it.cantidad}`).join(',') || 'vacío'}</p>;
}
function montar(usuario) {
  useAuth.mockReturnValue({ usuario });
  return render(<CartProvider><Sonda /></CartProvider>);
}
const resumen = () => screen.getByTestId('resumen').textContent;

describe('CartContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listar.mockResolvedValue([]);
  });

  describe('invitado (sin sesión): el carrito vive en memoria', () => {
    it('empieza vacío y no consulta a ms-carrito', async () => {
      await act(async () => montar(null));
      expect(resumen()).toBe('vacío');
      expect(mocks.listar).not.toHaveBeenCalled();
    });

    it('agregar suma el producto y repetirlo incrementa la cantidad', async () => {
      await act(async () => montar(null));
      await act(async () => carro.agregarProducto(mouse));
      await act(async () => carro.agregarProducto(mouse));
      expect(resumen()).toBe('p1x2');
      expect(mocks.agregar).not.toHaveBeenCalled();
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ toast: true, title: 'Producto añadido' }));
    });

    it('cambiarCantidad suma o resta y al llegar a 0 elimina la línea', async () => {
      await act(async () => montar(null));
      await act(async () => carro.agregarProducto(mouse));
      await act(async () => carro.cambiarCantidad('p1', 2));
      expect(resumen()).toBe('p1x3');
      await act(async () => carro.cambiarCantidad('p1', -3));
      expect(resumen()).toBe('vacío');
    });

    it('el total usa el precio con descuento', async () => {
      await act(async () => montar(null));
      await act(async () => carro.agregarProducto(mouse)); // 10.000
      await act(async () => carro.agregarProducto(teclado)); // 20.000 con 10% = 18.000
      expect(carro.total).toBe(28000);
    });

    it('eliminarProducto y vaciarCarrito limpian la memoria sin llamar al servicio', async () => {
      await act(async () => montar(null));
      await act(async () => carro.agregarProducto(mouse));
      await act(async () => carro.agregarProducto(teclado));
      await act(async () => carro.eliminarProducto('p1'));
      expect(resumen()).toBe('p2x1');
      await act(async () => carro.vaciarCarrito());
      expect(resumen()).toBe('vacío');
      expect(mocks.quitar).not.toHaveBeenCalled();
      expect(mocks.vaciar).not.toHaveBeenCalled();
    });
  });

  describe('con sesión: el carrito vive en ms-carrito', () => {
    const usuario = { id: 'u1' };

    it('carga el carrito del servicio al montar', async () => {
      mocks.listar.mockResolvedValue(enApi([mouse, 2]));
      await act(async () => montar(usuario));
      expect(mocks.listar).toHaveBeenCalledTimes(1);
      expect(resumen()).toBe('p1x2');
    });

    it('agregar llama al servicio y usa el carrito que devuelve', async () => {
      mocks.agregar.mockResolvedValue(enApi([mouse, 1]));
      await act(async () => montar(usuario));
      await act(async () => carro.agregarProducto(mouse));
      expect(mocks.agregar).toHaveBeenCalledWith('p1', 1);
      expect(resumen()).toBe('p1x1');
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Producto añadido' }));
    });

    it('si agregar falla avisa el motivo, no confirma y no cambia el carrito', async () => {
      mocks.agregar.mockRejectedValue(new Error("El producto 'p1' no existe."));
      await act(async () => montar(usuario));
      await act(async () => carro.agregarProducto(mouse));
      expect(Swal.fire).toHaveBeenCalledTimes(1);
      expect(Swal.fire).toHaveBeenCalledWith('No se pudo añadir el producto', "El producto 'p1' no existe.", 'error');
      expect(resumen()).toBe('vacío');
    });

    it('cambiarCantidad envía la nueva cantidad (cantidad actual + delta)', async () => {
      mocks.listar.mockResolvedValue(enApi([mouse, 2]));
      mocks.cambiar.mockResolvedValue(enApi([mouse, 3]));
      await act(async () => montar(usuario));
      await act(async () => carro.cambiarCantidad('p1', 1));
      expect(mocks.cambiar).toHaveBeenCalledWith('p1', 3);
      expect(resumen()).toBe('p1x3');
    });

    it('si la cantidad llega a 0 quita el producto en el servicio', async () => {
      mocks.listar.mockResolvedValue(enApi([mouse, 1]));
      mocks.quitar.mockResolvedValue([]);
      await act(async () => montar(usuario));
      await act(async () => carro.cambiarCantidad('p1', -1));
      expect(mocks.quitar).toHaveBeenCalledWith('p1');
      expect(mocks.cambiar).not.toHaveBeenCalled();
      expect(resumen()).toBe('vacío');
    });

    it('vaciarCarrito borra en el servicio y deja el carrito vacío', async () => {
      mocks.listar.mockResolvedValue(enApi([mouse, 1], [teclado, 2]));
      mocks.vaciar.mockResolvedValue(null);
      await act(async () => montar(usuario));
      await act(async () => carro.vaciarCarrito());
      expect(mocks.vaciar).toHaveBeenCalledTimes(1);
      expect(resumen()).toBe('vacío');
    });

    it('si vaciar falla conserva el carrito y avisa', async () => {
      mocks.listar.mockResolvedValue(enApi([mouse, 1]));
      mocks.vaciar.mockRejectedValue(new Error('sin conexión'));
      await act(async () => montar(usuario));
      await act(async () => carro.vaciarCarrito());
      expect(resumen()).toBe('p1x1');
      expect(Swal.fire).toHaveBeenCalledWith('No se pudo vaciar el carrito', 'sin conexión', 'error');
    });

    it('si ms-carrito no responde al cargar deja el carrito vacío sin romper', async () => {
      mocks.listar.mockRejectedValue(new Error('sin conexión'));
      await act(async () => montar(usuario));
      expect(resumen()).toBe('vacío');
      expect(carro.cargando).toBe(false);
    });
  });
});
