# Animação reveal da logo PX

## Objetivo
Aplicar à logo vetorial existente o movimento horizontal fornecido, mantendo exatamente os paths e as cores oficiais `#052849` e `#00C3E6`.

## Implementação
- Manter o componente `PXLogo` e toda a compatibilidade atual.
- Trocar a entrada cinematográfica atual por uma sequência horizontal: P, partes do X com pequeno stagger e GRUPO.
- Executar a sequência uma vez por montagem, sem repetição ou desaparecimento posterior.
- Preservar hover, parallax, responsividade, acessibilidade, reduced motion e cleanup GSAP.
- Isolar o deslocamento de entrada dos demais transforms para evitar conflitos.

## Validação
- Conferir geometria e cores dos nove paths.
- Verificar estado inicial, sequência final, hover, mobile e reduced motion.
- Confirmar compilação e ausência de erros no navegador.
