import {
  BarChart3,
  CalendarCheck,
  Instagram,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

type BusinessBenefit = {
  title: string;
  body: string;
  Icon: LucideIcon;
};

export const BUSINESS_BENEFITS: BusinessBenefit[] = [
  {
    title: "Aparece primero",
    body: "La Strategy que eliges gana la visibilidad justo cuando la gente decide a dónde ir — el Rank no se vende. El descuento de bienvenida convierte esa visibilidad en primeras visitas.",
    Icon: TrendingUp,
  },
  {
    title: "Llena la sala con la gente correcta",
    body: "Configura descuentos distintos para los usuarios gratis y los Premium, y atrae a quienes traen alcance o consumo — no a todos por igual.",
    Icon: Target,
  },
  {
    title: "Alcance en Instagram garantizado",
    body: "Las recompensas con historia se verifican antes de liberar el descuento — automático para cuentas públicas, captura y un toque del mesero para las privadas. Primero la exposición, siempre.",
    Icon: Instagram,
  },
  {
    title: "Reservas sin instalar nada",
    body: "Nuestro asistente reserva por los canales que ya usas — teléfono, WhatsApp, Instagram, correo. Ves cuántas personas y qué tipo de cliente antes de la visita.",
    Icon: CalendarCheck,
  },
  {
    title: "Resultados, no promesas",
    body: "Un solo tablero: el embudo completo (vistas → interés → recompensas → visitas → historias), gasto influenciado, tasa de regreso y retorno de inversión, con un copiloto de IA que te arma la siguiente promoción.",
    Icon: BarChart3,
  },
];
