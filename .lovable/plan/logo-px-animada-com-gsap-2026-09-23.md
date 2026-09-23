# Logo PX animada com GSAP

## Objetivo
Evoluir o componente institucional existente para usar o SVG anexado inline, preservando exatamente seus 8 paths, `viewBox`, proporções e desenho.

## Implementação
- Instalar apenas `gsap` e registrar `ScrollTrigger` uma única vez no navegador.
- Converter o SVG fornecido em JSX inline sem alterar os dados dos paths; adicionar grupos semânticos `data-logo-part` para P, duas partes do X e as cinco letras de GRUPO.
- Evoluir `PxGrupoLogo` e expor também `PXLogo`, mantendo compatibilidade com todas as chamadas atuais (`height`, `onDark`, `className`).
- Adicionar propriedades `animateOnScroll`, `enableHover` e `enableParallax`, com entrada cinematográfica, montagem do X, entrada escalonada de GRUPO e acomodação final.
- Implementar hover/tilt somente para ponteiro preciso e parallax sutil com `ScrollTrigger`, reduzido em telas menores.
- Usar `gsap.context()`, listeners locais e cleanup completo de timeline, tweens e triggers.
- Respeitar `prefers-reduced-motion`, exibindo imediatamente o estado final sem tilt ou parallax.

## Validação
- Confirmar que os 8 paths e o `viewBox` permanecem idênticos ao arquivo anexado.
- Verificar login e demais locais que já usam a logo, sem alterar autenticação ou layout.
- Testar entrada, hover, scroll, resize, navegação, mobile e reduced motion no navegador.
- Confirmar compilação sem erros e ausência de falhas no console.
