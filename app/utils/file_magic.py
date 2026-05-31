"""Validação de tipo de arquivo por assinatura de bytes (magic bytes).
Não confia em Content-Type nem extensão do nome — ambos podem ser falsificados."""

_JPEG = b'\xff\xd8\xff'
_PNG  = b'\x89PNG\r\n\x1a\n'
_GIF1 = b'GIF87a'
_GIF2 = b'GIF89a'
_RIFF = b'RIFF'
_WEBP = b'WEBP'

# Tipos de imagem → extensão segura derivada do conteúdo real
_CONTENT_TYPES = {
    '.jpg':  'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
}


def detect_image(data: bytes) -> tuple[str, str] | tuple[None, None]:
    """Retorna (extensão, content_type) se os bytes forem uma imagem reconhecida,
    ou (None, None) caso contrário."""
    if data[:3] == _JPEG:
        return '.jpg', 'image/jpeg'
    if data[:8] == _PNG:
        return '.png', 'image/png'
    if data[:6] in (_GIF1, _GIF2):
        return '.gif', 'image/gif'
    if len(data) >= 12 and data[:4] == _RIFF and data[8:12] == _WEBP:
        return '.webp', 'image/webp'
    return None, None


def is_valid_image(data: bytes) -> bool:
    ext, _ = detect_image(data)
    return ext is not None
