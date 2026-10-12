import { render, screen } from '@testing-library/react';
import Nosotros from '../pages/Nosotros';

describe('Nosotros', () => {
  it('presenta la tienda, las fotos del local y la dirección', () => {
    render(<Nosotros />);
    expect(screen.getByRole('heading', { name: '¿Quiénes somos?' })).toBeInTheDocument();
    expect(screen.getByText(/tienda especializada en productos tecnológicos/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Local vista 1' })).toHaveAttribute('src', '/img/ubi2.png');
    expect(screen.getByRole('img', { name: 'Local vista 2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Interior tienda' })).toBeInTheDocument();
    const mapa = screen.getByRole('link', { name: /Av\. Antonio Varas/ });
    expect(mapa).toHaveAttribute('href', 'https://maps.app.goo.gl/wAEHF5qsQ3KKPWoz8');
    expect(mapa).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('img', { name: 'Mapa de ubicación' })).toHaveAttribute('src', '/img/ubi.png');
  });

  it('el botón principal lleva al inicio para empezar a comprar', () => {
    render(<Nosotros />);
    expect(screen.getByRole('link', { name: /Comenzar a comprar/ })).toHaveAttribute('href', '/');
  });
});
