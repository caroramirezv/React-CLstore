import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import {
  listarCarrito,
  agregarAlCarrito,
  cambiarCantidadCarrito,
  quitarDelCarrito,
  vaciarCarritoRemoto,
} from '../api/carritoApi';
import { useAuth } from './AuthContext';
import { calcularPrecioFinal } from '../lib/validaciones';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { usuario } = useAuth();
  const [items, setItems] = useState([]); 
  const [cargando, setCargando] = useState(false);

  // Con sesión, el carrito vive en ms-carrito; sin sesión (invitado) solo en memoria.
  const cargarCarritoRemoto = useCallback(async () => {
    if (!usuario) return;
    setCargando(true);
    try {
      setItems((await listarCarrito()) || []);
    } catch {
      // se conserva lo que haya en pantalla
    } finally {
      setCargando(false);
    }
  }, [usuario]);

  useEffect(() => {
    if (usuario) {
      cargarCarritoRemoto();
    } else {
      setItems([]);
    }
  }, [usuario, cargarCarritoRemoto]);

  function avisarError(titulo, error) {
    Swal.fire(titulo, error?.message || 'Ocurrió un error inesperado.', 'error');
  }

  async function agregarProducto(producto) {
    if (usuario) {
      try {
        setItems(await agregarAlCarrito(producto.id, 1));
      } catch (error) {
        avisarError('No se pudo añadir el producto', error);
        return;
      }
    } else {
      setItems((prev) => {
        const existente = prev.find((it) => it.producto_id === producto.id);
        if (existente) {
          return prev.map((it) =>
            it.producto_id === producto.id ? { ...it, cantidad: it.cantidad + 1 } : it
          );
        }
        return [
          ...prev,
          {
            producto_id: producto.id,
            cantidad: 1,
            productos: {
              id: producto.id, nombre: producto.nombre, precio: producto.precio,
              imagen: producto.imagen, descuento_porcentaje: producto.descuento_porcentaje, stock: producto.stock,
            },
          },
        ];
      });
    }

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Producto añadido',
      showConfirmButton: false,
      timer: 1500,
    });
  }

  async function cambiarCantidad(productoId, delta) {
    const item = items.find((it) => it.producto_id === productoId);
    if (!item) return;
    const nuevaCantidad = item.cantidad + delta;

    if (nuevaCantidad <= 0) {
      await eliminarProducto(productoId);
      return;
    }

    if (usuario) {
      try {
        setItems(await cambiarCantidadCarrito(productoId, nuevaCantidad));
      } catch (error) {
        avisarError('No se pudo cambiar la cantidad', error);
      }
    } else {
      setItems((prev) =>
        prev.map((it) => (it.producto_id === productoId ? { ...it, cantidad: nuevaCantidad } : it))
      );
    }
  }

  async function eliminarProducto(productoId) {
    if (usuario) {
      try {
        setItems(await quitarDelCarrito(productoId));
      } catch (error) {
        avisarError('No se pudo quitar el producto', error);
      }
    } else {
      setItems((prev) => prev.filter((it) => it.producto_id !== productoId));
    }
  }

  async function vaciarCarrito() {
    if (usuario) {
      try {
        await vaciarCarritoRemoto();
      } catch (error) {
        avisarError('No se pudo vaciar el carrito', error);
        return;
      }
    }
    setItems([]);
  }

  const total = items.reduce((acc, it) => {
    const { precioFinal } = calcularPrecioFinal(it.productos);
    return acc + precioFinal * it.cantidad;
  }, 0);

  const value = { items, cargando, total, agregarProducto, cambiarCantidad, eliminarProducto, vaciarCarrito };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
