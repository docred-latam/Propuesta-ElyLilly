import numpy as np
from PIL import Image

# El abanico del referente no sale limpio con repeating-conic-gradient (moiré a este tamaño):
# se genera como imagen con supersampling, una por marca. La proporción manda: el color llena,
# los rayos son surcos finos encima, no una trama.
W, H, S = 1000, 430, 3

def rayos(c1, c2, salida):
    w, h = W*S, H*S
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ox, oy = w*.5, h*1.22                        # el foco vive por debajo de la tarjeta
    dx, dy = xx-ox, yy-oy
    r = np.hypot(dx, dy); ang = np.arctan2(dy, dx)

    # Color: mesh radial desde el foco, c1 en el núcleo, c2 hacia los lados
    rn = np.clip(r/(h*1.30), 0, 1)
    t = np.clip(rn/.70, 0, 1)[..., None]
    col = np.array(c1[:3], np.float32)*(1-t) + np.array(c2[:3], np.float32)*t
    # Núcleo aclarado, como el brillo del centro en el referente
    glow = np.clip(1 - r/(h*.52), 0, 1)[..., None]**1.6
    col = col*(1-glow*.55) + 255.0*glow*.55
    a_col = np.clip((1-rn)/.58, 0, 1)**.85 * (c1[3]*(1-t[...,0]) + c2[3]*t[...,0])

    # Rayos: surcos blancos finos, separados, que se abren desde el foco
    per = np.pi/104
    f = np.abs(((ang % per)/per) - .5) * 2
    ray = np.clip((f - .58)/.30, 0, 1)
    ray *= np.clip(r/(h*.20), 0, 1)              # el foco no queda como un nudo
    blanco = ray * .62

    rgb = col*(1-blanco[..., None]) + 255.0*blanco[..., None]
    alpha = np.clip(a_col + blanco*.35, 0, 1)
    alpha *= np.clip((yy/h - .02)/.56, 0, 1)**1.25   # se funde con el blanco de la tarjeta

    img = np.dstack([rgb, alpha*255]).astype(np.uint8)
    im = Image.fromarray(img).resize((W, H), Image.LANCZOS)
    im.save(salida, 'WEBP', quality=80, method=6)
    print(salida)

rayos((168,85,247,.95), (233,66,53,.85), 'img/rayos-mounjaro.webp')
rayos((0,174,199,.95),  (59,43,122,.78),  'img/rayos-verzenio.webp')
rayos((123,63,160,.88), (151,214,131,.92),'img/rayos-ebglyss.webp')
