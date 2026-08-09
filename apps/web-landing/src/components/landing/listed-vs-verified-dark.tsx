import { BadgeCheck, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Explicador compacto de dos columnas, versión oscura: qué obtiene un lugar
// antes y después de reclamar su perfil.
function ListedVsVerifiedDark() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="border-background/20 bg-background/5 rounded-2xl border border-dashed p-6">
        <div className="flex items-center gap-2">
          <ScanLine className="text-background/60 h-4 w-4" />
          <h3 className="font-display text-base font-semibold tracking-tight">
            Listado
          </h3>
          <Badge
            variant="outline"
            className="border-background/30 text-background/60 ml-auto rounded-full text-[10px]"
          >
            Automático
          </Badge>
        </div>
        <p className="text-background/70 mt-3 text-[13px] leading-relaxed">
          Armado para ti desde datos públicos — visible y reservable con IA, sin
          costo y sin registro. Sin recompensas, sin tablero.
        </p>
      </div>
      <div className="border-primary/50 bg-background/10 rounded-2xl border p-6">
        <div className="flex items-center gap-2">
          <BadgeCheck className="text-primary h-4 w-4" />
          <h3 className="font-display text-base font-semibold tracking-tight">
            Verificado
          </h3>
          <Badge className="bg-pink-gradient ml-auto rounded-full border-0 text-[10px] text-white">
            Tú lo reclamas
          </Badge>
        </div>
        <p className="text-background/70 mt-3 text-[13px] leading-relaxed">
          Membresía Mesita (MX$1,000/año): reclama tu perfil, da recompensas,
          elige tu Strategy de descuentos y abre el tablero. El Rank no se
          vende — la Strategy gana la visibilidad.
        </p>
      </div>
    </div>
  );
}

export { ListedVsVerifiedDark };
