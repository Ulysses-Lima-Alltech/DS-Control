export function documentCleaner(document: string) {
  return document.replace(/\D/g, '');
}

export function documentFormatter(document: string) {
  const cleaned = documentCleaner(document);

  if (cleaned.length <= 11) {
    // CPF format: XXX.XXX.XXX-XX
    return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else {
    // CNPJ format: XX.XXX.XXX/XXXX-XX
    return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
}
