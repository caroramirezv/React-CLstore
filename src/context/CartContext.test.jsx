import { renderHook, act, waitFor } from '@testing-library/react';
import Swal from 'sweetalert2';
import { CartProvider, useCart } from './CartContext';

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }));
vi.mock('./AuthContext', () => ({ useAuth: vi.fn() }));

// Mock de Supabase: cada método devuelve la misma cadena, y al hacer "await"
// la cadena resuelve con `respuesta`.
const mocks = vi.hoisted(() => {
  const respuesta = { data: [], error: null };
  const chain = {};
  ['select', 'update', 'insert', 'delete', 'eq'].forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  chain.then = (resolve) => resolve(respuesta);
  const from = vi.fn(() => chain);
  return { chain, from, respuesta };
});
vi.mock('../lib/supabaseClient', () => ({ supabase: { from: mocks.from } }));

import { useAuth } from './AuthContext';

const mouse = { id: 1, nombre: 'Mouse', precio: 10000, imagen: 'mouse.jpg', descuento_porcentaje: null, stock: 5 };
const teclado = { id: 2, nombre: 'Teclado', precio: 20000, imagen: 'teclado.jpg', descuento_porcentaje: 10, stock: 5 };

const wrapper = ({ children }) => <CartProvider>{children}</CartProvider>;

function renderCart() {
  return renderHook(() => useCart(), { wrapper });
}

describe('CartContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.respuesta.data = [];
    mocks.respuesta.error = null;
  });

  describe('invitado (sin sesión)', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ usuario: null });
    });

    it('parte con el carrito vacío y total 0', () => {
      const { result } = renderCart();
      expect(result.current.items).toEqual([]);
      expect(result.current.total).toBe(0);
    });

    it('agregarProducto añade el producto con cantidad 1 y avisa con un toast', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0]).toMatchObject({ producto_id: 1, cantidad: 1 });
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ toast: true, icon: 'success' }));
    });

    it('agregar el mismo producto dos veces suma la cantidad, no duplica la fila', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].cantidad).toBe(2);
    });

    it('el total suma precio final × cantidad aplicando descuentos', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      await act(async () => {
        await result.current.agregarProducto(teclado);
      });
      // Mouse 2 × 10.000 = 20.000 + Teclado 1 × (20.000 con 10% dto = 18.000)
      expect(result.current.total).toBe(38000);
    });

    it('cambiarCantidad con +1 y −1 modifica la cantidad', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      await act(async () => {
        await result.current.cambiarCantidad(1, 1);
      });
      expect(result.current.items[0].cantidad).toBe(2);
      await act(async () => {
        await result.current.cambiarCantidad(1, -1);
      });
      expect(result.current.items[0].cantidad).toBe(1);
    });

    it('cambiarCantidad que deja la cantidad en 0 elimina el producto', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      await act(async () => {
        await result.current.cambiarCantidad(1, -1);
      });
      expect(result.current.items).toEqual([]);
      expect(result.current.total).toBe(0);
    });

    it('cambiarCantidad con un id que no está en el carrito no cambia nada', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      await act(async () => {
        await result.current.cambiarCantidad(999, 1);
      });
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].cantidad).toBe(1);
    });

    it('eliminarProducto quita solo ese producto', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      await act(async () => {
        await result.current.agregarProducto(teclado);
      });
      await act(async () => {
        await result.current.eliminarProducto(1);
      });
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].producto_id).toBe(2);
    });

    it('vaciarCarrito deja el carrito vacío', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      await act(async () => {
        await result.current.vaciarCarrito();
      });
      expect(result.current.items).toEqual([]);
    });

    it('no consulta a Supabase', async () => {
      const { result } = renderCart();
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      expect(mocks.from).not.toHaveBeenCalled();
    });
  });

  describe('usuario con sesión', () => {
    // Debe ser el mismo objeto en cada render: el contexto lo usa como dependencia de useEffect.
    const usuario = { id: 'u1' };
    const filaMouse = {
      id: 100,
      producto_id: 1,
      cantidad: 2,
      productos: { id: 1, nombre: 'Mouse', precio: 10000, imagen: 'mouse.jpg', descuento_porcentaje: null },
    };

    beforeEach(() => {
      useAuth.mockReturnValue({ usuario });
      mocks.respuesta.data = [filaMouse];
    });

    it('carga el carrito del usuario desde Supabase al montar', async () => {
      const { result } = renderCart();
      await waitFor(() => expect(result.current.items).toHaveLength(1));
      expect(mocks.from).toHaveBeenCalledWith('carrito_items');
      expect(mocks.chain.eq).toHaveBeenCalledWith('usuario_id', 'u1');
      expect(result.current.total).toBe(20000);
    });

    it('agregar un producto que ya está en el carrito actualiza su cantidad (+1)', async () => {
      const { result } = renderCart();
      await waitFor(() => expect(result.current.items).toHaveLength(1));
      await act(async () => {
        await result.current.agregarProducto(mouse);
      });
      expect(mocks.chain.update).toHaveBeenCalledWith({ cantidad: 3 });
      expect(mocks.chain.eq).toHaveBeenCalledWith('id', 100);
    });

    it('agregar un producto nuevo inserta una fila con cantidad 1', async () => {
      const { result } = renderCart();
      await waitFor(() => expect(result.current.items).toHaveLength(1));
      await act(async () => {
        await result.current.agregarProducto(teclado);
      });
      expect(mocks.chain.insert).toHaveBeenCalledWith({ usuario_id: 'u1', producto_id: 2, cantidad: 1 });
    });

    it('vaciarCarrito borra en Supabase las filas del usuario y limpia el estado', async () => {
      const { result } = renderCart();
      await waitFor(() => expect(result.current.items).toHaveLength(1));
      await act(async () => {
        await result.current.vaciarCarrito();
      });
      expect(mocks.chain.delete).toHaveBeenCalled();
      expect(mocks.chain.eq).toHaveBeenCalledWith('usuario_id', 'u1');
      expect(result.current.items).toEqual([]);
    });
  });
});
