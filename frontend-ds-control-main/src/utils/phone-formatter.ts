export function phoneCleaner(phone: string) {
  return phone.replace(/\D/g, '');
}

export function phoneFormatter(phone: string) {
  if (phone.length >= 14) {
    return phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  } else if (phone.length >= 13) {
    return phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4');
  } else if (phone.length >= 12) {
    return phone.replace(/(\d{2})(\d{2})(\d{4})(\d{4})/, '+$1 ($2) $3-$4');
  } else if (phone.length >= 11) {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (phone.length >= 10) {
    return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (phone.length >= 9) {
    return phone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else {
    return phone;
  }
}
