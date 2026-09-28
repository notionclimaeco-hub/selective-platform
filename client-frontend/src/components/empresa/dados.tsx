import { Linhas, Seccao } from "./seccao"

/** Legal profile, read-only. */
export function SeccaoDados({
  empresa,
}: {
  empresa: {
    nomeLegal: string
    nif: string
    morada: string
    email: string
    telefone: string
    certifNumero?: string
  }
}) {
  return (
    <Seccao id="dados" titulo="Dados da empresa">
      <Linhas
        itens={[
          { label: "Nome", valor: empresa.nomeLegal },
          { label: "NIF", valor: empresa.nif },
          { label: "Morada", valor: empresa.morada },
          { label: "Email de faturação", valor: empresa.email },
          { label: "Telefone", valor: empresa.telefone },
          ...(empresa.certifNumero
            ? [{ label: "CERTIF", valor: empresa.certifNumero }]
            : []),
        ]}
      />
    </Seccao>
  )
}
