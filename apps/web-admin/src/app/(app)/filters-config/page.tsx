// Discovery — deliberately empty.
//
// The whole config surface was deleted in MESITA-1183 and the two tabs joined
// into this one page. It is the empty lot Discovery gets rebuilt on: seven
// scoring signals (MESITA-1196) and eight engines (MESITA-1197). Add no config
// here ahead of that rebuild.
export default function DiscoveryPage() {
  return <p className="text-muted-foreground text-sm">hello world</p>;
}
