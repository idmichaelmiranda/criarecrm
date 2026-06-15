import json
import unicodedata
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import select, or_

from app.database.connection import get_db
from app.models.implantacao import Implantacao
from app.models.instalacao import Instalacao
from app.models.cliente import Cliente
from app.models.usuario import Usuario

router = APIRouter(prefix="/resultados", tags=["resultados"])

# ── Helpers ───────────────────────────────────────────────────────────────────

TIPO_LABEL = {
    "instalacao_pdv": "PDV Adicional", "pdv": "PDV Adicional",
    "instalacao_sia_pdv": "SIA PDV", "sia_pdv": "SIA PDV",
    "instalacao_sia": "SIA", "sia": "SIA",
    "instalacao_coletor": "Coletor Mobile", "coletor": "Coletor Mobile",
    "instalacao_forca_vendas": "Força de Vendas", "forca_vendas": "Força de Vendas",
    "instalacao_impressora": "Impressora", "impressora": "Impressora",
    "instalacao_outro": "Outro", "outro": "Outro",
}

ESTADO_CENTROIDES = {
    "AC": (-8.77, -70.55), "AL": (-9.71, -35.73), "AM": (-3.47, -65.10),
    "AP": (1.41, -51.77),  "BA": (-12.96, -38.51), "CE": (-3.72, -38.54),
    "DF": (-15.83, -47.86), "ES": (-19.19, -40.34), "GO": (-16.64, -49.31),
    "MA": (-2.55, -44.30),  "MG": (-18.10, -44.38), "MS": (-20.51, -54.54),
    "MT": (-12.64, -55.42), "PA": (-5.53, -52.29),  "PB": (-7.28, -36.72),
    "PE": (-8.28, -35.07),  "PI": (-8.28, -43.68),  "PR": (-24.89, -51.55),
    "RJ": (-22.84, -43.15), "RN": (-5.81, -36.59),  "RO": (-11.22, -62.80),
    "RR": (1.99, -61.33),   "RS": (-30.17, -53.50),  "SC": (-27.45, -50.95),
    "SE": (-10.57, -37.45), "SP": (-22.19, -48.79),  "TO": (-9.47, -48.33),
}

# Coordenadas reais das principais cidades brasileiras (~300 municípios)
# Fonte: IBGE / OpenStreetMap. Chave: (cidade_normalizada, UF)
CIDADES_COORDS: dict[tuple[str, str], tuple[float, float]] = {
    # SP
    ("sao paulo", "SP"): (-23.5505, -46.6333),
    ("guarulhos", "SP"): (-23.4549, -46.5333),
    ("campinas", "SP"): (-22.9056, -47.0608),
    ("sao bernardo do campo", "SP"): (-23.6939, -46.5650),
    ("santo andre", "SP"): (-23.6639, -46.5383),
    ("osasco", "SP"): (-23.5329, -46.7919),
    ("ribeirao preto", "SP"): (-21.1775, -47.8103),
    ("sorocaba", "SP"): (-23.5015, -47.4526),
    ("sao jose dos campos", "SP"): (-23.1794, -45.8869),
    ("mogi das cruzes", "SP"): (-23.5229, -46.1853),
    ("jundiai", "SP"): (-23.1864, -46.8844),
    ("piracicaba", "SP"): (-22.7253, -47.6492),
    ("bauru", "SP"): (-22.3246, -49.0756),
    ("sao jose do rio preto", "SP"): (-20.8197, -49.3797),
    ("franca", "SP"): (-20.5390, -47.4008),
    ("limeira", "SP"): (-22.5642, -47.4019),
    ("presidente prudente", "SP"): (-22.1256, -51.3889),
    ("marilia", "SP"): (-22.2131, -49.9456),
    ("araçatuba", "SP"): (-21.2089, -50.4328),
    ("aracatuba", "SP"): (-21.2089, -50.4328),
    ("araraquara", "SP"): (-21.7845, -48.1758),
    ("taubate", "SP"): (-23.0267, -45.5556),
    ("barueri", "SP"): (-23.5114, -46.8760),
    ("indaiatuba", "SP"): (-23.0900, -47.2189),
    ("americana", "SP"): (-22.7389, -47.3319),
    ("sao carlos", "SP"): (-22.0154, -47.8911),
    ("catanduva", "SP"): (-21.1372, -48.9728),
    ("botucatu", "SP"): (-22.8836, -48.4447),
    ("santos", "SP"): (-23.9608, -46.3336),
    ("suzano", "SP"): (-23.5428, -46.3108),
    ("diadema", "SP"): (-23.6861, -46.6228),
    ("maua", "SP"): (-23.6678, -46.4608),
    ("carapicuiba", "SP"): (-23.5239, -46.8350),
    ("itaquaquecetuba", "SP"): (-23.4867, -46.3486),
    ("praia grande", "SP"): (-24.0058, -46.4022),
    ("cotia", "SP"): (-23.6036, -46.9194),
    ("taboao da serra", "SP"): (-23.6097, -46.7569),
    # MG
    ("belo horizonte", "MG"): (-19.9167, -43.9345),
    ("uberlandia", "MG"): (-18.9186, -48.2772),
    ("contagem", "MG"): (-19.9317, -44.0536),
    ("juiz de fora", "MG"): (-21.7642, -43.3503),
    ("betim", "MG"): (-19.9678, -44.1983),
    ("montes claros", "MG"): (-16.7286, -43.8617),
    ("ribeirao das neves", "MG"): (-19.7672, -44.0869),
    ("uberaba", "MG"): (-19.7483, -47.9317),
    ("governador valadares", "MG"): (-18.8511, -41.9494),
    ("ipatinga", "MG"): (-19.4681, -42.5361),
    ("sete lagoas", "MG"): (-19.4658, -44.2467),
    ("divinopolis", "MG"): (-20.1386, -44.8836),
    ("santa luzia", "MG"): (-19.7697, -43.8511),
    ("ibirite", "MG"): (-20.0214, -44.0567),
    ("pocos de caldas", "MG"): (-21.7872, -46.5614),
    ("patos de minas", "MG"): (-18.5786, -46.5181),
    ("pouso alegre", "MG"): (-22.2297, -45.9369),
    ("teofilo otoni", "MG"): (-17.8597, -41.5056),
    ("barbacena", "MG"): (-21.2261, -43.7736),
    ("varginha", "MG"): (-21.5511, -45.4306),
    ("itabira", "MG"): (-19.6189, -43.2267),
    ("muriae", "MG"): (-21.1311, -42.3672),
    ("lavras", "MG"): (-21.2458, -44.9997),
    ("coronel fabriciano", "MG"): (-19.5194, -42.6272),
    ("nepomuceno", "MG"): (-21.2369, -45.2356),
    ("areado", "MG"): (-21.3614, -46.1456),
    ("alfenas", "MG"): (-21.4289, -45.9486),
    ("tres pontas", "MG"): (-21.3658, -45.5125),
    ("boa esperanca", "MG"): (-21.0906, -45.5631),
    ("sao sebastiao do paraiso", "MG"): (-20.9175, -46.9908),
    ("passos", "MG"): (-20.7197, -46.6097),
    ("formiga", "MG"): (-20.4644, -45.4283),
    ("araxa", "MG"): (-19.5944, -46.9403),
    ("uba", "MG"): (-21.1158, -42.9422),
    ("vicosa", "MG"): (-20.7561, -42.8822),
    ("sao joao del rei", "MG"): (-21.1339, -44.2633),
    ("conselheiro lafaiete", "MG"): (-20.6619, -43.7869),
    ("ouro preto", "MG"): (-20.3854, -43.5035),
    ("mariana", "MG"): (-20.3775, -43.4158),
    ("itajuba", "MG"): (-22.4236, -45.4525),
    ("itabirito", "MG"): (-20.2528, -43.8011),
    ("congonhas", "MG"): (-20.5006, -43.8558),
    ("carangola", "MG"): (-20.7325, -42.0222),
    ("manhuacu", "MG"): (-20.2583, -42.0272),
    ("cataguases", "MG"): (-21.3908, -42.6981),
    ("leopoldina", "MG"): (-21.5294, -42.6433),
    ("tres coracoes", "MG"): (-21.6889, -45.2544),
    ("sao lourenco", "MG"): (-22.1131, -45.0572),
    ("caxambu", "MG"): (-21.9750, -44.9311),
    ("andradas", "MG"): (-22.0672, -46.5703),
    ("monte siao", "MG"): (-22.6617, -46.5728),
    ("itapeva", "MG"): (-22.6969, -46.6028),
    ("extrema", "MG"): (-22.8594, -46.3208),
    ("itamonte", "MG"): (-22.2831, -44.8678),
    ("pirangucu", "MG"): (-22.4042, -45.5056),
    ("cambuquira", "MG"): (-21.8528, -45.2911),
    ("cristina", "MG"): (-22.2150, -45.2664),
    ("carmo de minas", "MG"): (-22.1211, -45.1211),
    ("dom vicoso", "MG"): (-22.3386, -45.2264),
    ("olimpio noronha", "MG"): (-22.2378, -45.2678),
    ("arantina", "MG"): (-21.9311, -44.2567),
    ("baependi", "MG"): (-21.9628, -44.8914),
    ("cruzilia", "MG"): (-21.8381, -44.7969),
    ("ingai", "MG"): (-21.4008, -44.9253),
    ("itumirim", "MG"): (-21.3139, -44.8753),
    ("carrancas", "MG"): (-21.4897, -44.6397),
    ("nazareno", "MG"): (-21.2139, -44.6139),
    ("entre rios de minas", "MG"): (-20.6675, -43.9839),
    ("queluzito", "MG"): (-20.7839, -44.0953),
    ("lamim", "MG"): (-20.6631, -43.5528),
    ("diogo de vasconcelos", "MG"): (-20.3975, -43.2878),
    ("acaiaca", "MG"): (-20.3597, -43.1439),
    ("ponte nova", "MG"): (-20.4156, -42.9083),
    ("rio piracicaba", "MG"): (-19.9275, -43.1728),
    ("santa barbara", "MG"): (-19.9658, -43.4086),
    ("raposos", "MG"): (-19.9625, -43.8061),
    ("nova lima", "MG"): (-19.9847, -43.8483),
    ("sabara", "MG"): (-19.8869, -43.8114),
    ("ribeirao das neves", "MG"): (-19.7672, -44.0869),
    ("pedro leopoldo", "MG"): (-19.6153, -44.0428),
    ("lagoa santa", "MG"): (-19.6294, -43.8919),
    ("vespasiano", "MG"): (-19.6914, -43.9228),
    ("esmeraldas", "MG"): (-19.7614, -44.3094),
    ("brumadinho", "MG"): (-20.1428, -44.1983),
    ("itauna", "MG"): (-20.0778, -44.5764),
    ("pará de minas", "MG"): (-19.8608, -44.6097),
    ("para de minas", "MG"): (-19.8608, -44.6097),
    ("martinho campos", "MG"): (-19.3289, -45.2364),
    ("joao pinheiro", "MG"): (-17.7436, -46.1728),
    ("patos de minas", "MG"): (-18.5786, -46.5181),
    ("presidente olegario", "MG"): (-18.4103, -46.4178),
    ("lagoa formosa", "MG"): (-18.7769, -46.4064),
    ("varjao de minas", "MG"): (-18.3769, -45.9589),
    ("abaeté", "MG"): (-19.1558, -45.4453),
    ("abaete", "MG"): (-19.1558, -45.4453),
    # RJ
    ("rio de janeiro", "RJ"): (-22.9068, -43.1729),
    ("sao goncalo", "RJ"): (-22.8269, -43.0539),
    ("duque de caxias", "RJ"): (-22.7856, -43.3117),
    ("nova iguacu", "RJ"): (-22.7592, -43.4511),
    ("niteroi", "RJ"): (-22.8838, -43.1044),
    ("belford roxo", "RJ"): (-22.7644, -43.3997),
    ("sao joao de meriti", "RJ"): (-22.8022, -43.3733),
    ("campos dos goytacazes", "RJ"): (-21.7545, -41.3244),
    ("petropolis", "RJ"): (-22.5050, -43.1786),
    ("volta redonda", "RJ"): (-22.5231, -44.1042),
    ("macae", "RJ"): (-22.3711, -41.7872),
    ("cabo frio", "RJ"): (-22.8794, -42.0186),
    ("angra dos reis", "RJ"): (-23.0067, -44.3178),
    ("itaborai", "RJ"): (-22.7469, -42.8592),
    # ES
    ("vitoria", "ES"): (-20.3155, -40.3128),
    ("vila velha", "ES"): (-20.3297, -40.2922),
    ("cariacica", "ES"): (-20.2639, -40.4169),
    ("serra", "ES"): (-20.1289, -40.3075),
    ("cachoeiro de itapemirim", "ES"): (-20.8489, -41.1128),
    ("linhares", "ES"): (-19.3956, -40.0644),
    ("colatina", "ES"): (-19.5386, -40.6306),
    # BA
    ("salvador", "BA"): (-12.9714, -38.5014),
    ("feira de santana", "BA"): (-12.2664, -38.9663),
    ("vitoria da conquista", "BA"): (-14.8658, -40.8443),
    ("camaçari", "BA"): (-12.6992, -38.3242),
    ("camacari", "BA"): (-12.6992, -38.3242),
    ("itabuna", "BA"): (-14.7867, -39.2806),
    ("ilheus", "BA"): (-14.7889, -39.0428),
    ("juazeiro", "BA"): (-9.4289, -40.5028),
    ("lauro de freitas", "BA"): (-12.8972, -38.3289),
    # PR
    ("curitiba", "PR"): (-25.4278, -49.2731),
    ("londrina", "PR"): (-23.3045, -51.1696),
    ("maringa", "PR"): (-23.4205, -51.9333),
    ("ponta grossa", "PR"): (-25.0945, -50.1633),
    ("cascavel", "PR"): (-24.9578, -53.4550),
    ("sao jose dos pinhais", "PR"): (-25.5317, -49.2072),
    ("colombo", "PR"): (-25.2922, -49.2236),
    ("guarapuava", "PR"): (-25.3953, -51.4564),
    ("paranagua", "PR"): (-25.5194, -48.5089),
    ("araucaria", "PR"): (-25.5933, -49.4103),
    ("toledo", "PR"): (-24.7244, -53.7436),
    ("apucarana", "PR"): (-23.5503, -51.4611),
    ("campo largo", "PR"): (-25.4594, -49.5281),
    ("foz do iguacu", "PR"): (-25.5478, -54.5882),
    # RS
    ("porto alegre", "RS"): (-30.0346, -51.2177),
    ("caxias do sul", "RS"): (-29.1681, -51.1794),
    ("canoas", "RS"): (-29.9178, -51.1839),
    ("pelotas", "RS"): (-31.7654, -52.3376),
    ("santa maria", "RS"): (-29.6842, -53.8069),
    ("gravatai", "RS"): (-29.9442, -50.9914),
    ("viamao", "RS"): (-30.0814, -51.0233),
    ("novo hamburgo", "RS"): (-29.6783, -51.1306),
    ("sao leopoldo", "RS"): (-29.7597, -51.1469),
    ("rio grande", "RS"): (-32.0350, -52.0986),
    ("alvorada", "RS"): (-29.9886, -51.0839),
    ("passo fundo", "RS"): (-28.2622, -52.4083),
    ("sapucaia do sul", "RS"): (-29.8272, -51.1522),
    ("uruguaiana", "RS"): (-29.7547, -57.0883),
    # SC
    ("florianopolis", "SC"): (-27.5954, -48.5480),
    ("joinville", "SC"): (-26.3044, -48.8487),
    ("blumenau", "SC"): (-26.9195, -49.0661),
    ("sao jose", "SC"): (-27.5939, -48.6394),
    ("chapeco", "SC"): (-27.1005, -52.6150),
    ("criciuma", "SC"): (-28.6775, -49.3697),
    ("itajai", "SC"): (-26.9075, -48.6619),
    ("lages", "SC"): (-27.8153, -50.3264),
    ("balneario camboriu", "SC"): (-26.9906, -48.6349),
    # GO
    ("goiania", "GO"): (-16.6869, -49.2648),
    ("aparecida de goiania", "GO"): (-16.8232, -49.2436),
    ("anapolis", "GO"): (-16.3281, -48.9531),
    ("rio verde", "GO"): (-17.7981, -50.9258),
    ("luziania", "GO"): (-16.2528, -47.9508),
    ("aguas lindas de goias", "GO"): (-15.7439, -48.2817),
    ("valparaiso de goias", "GO"): (-16.0736, -47.9964),
    ("trindade", "GO"): (-16.6489, -49.4878),
    ("formosa", "GO"): (-15.5378, -47.3347),
    # DF
    ("brasilia", "DF"): (-15.7942, -47.8825),
    ("taguatinga", "DF"): (-15.8372, -48.0536),
    ("ceilandia", "DF"): (-15.8136, -48.1108),
    ("samambaia", "DF"): (-15.8778, -48.0800),
    ("planaltina", "DF"): (-15.6228, -47.6478),
    # CE
    ("fortaleza", "CE"): (-3.7172, -38.5433),
    ("caucaia", "CE"): (-3.7411, -38.6533),
    ("juazeiro do norte", "CE"): (-7.2133, -39.3150),
    ("maracanau", "CE"): (-3.8756, -38.6253),
    ("sobral", "CE"): (-3.6883, -40.3497),
    ("crato", "CE"): (-7.2342, -39.4094),
    ("itapipoca", "CE"): (-3.4950, -39.5794),
    # PE
    ("recife", "PE"): (-8.0539, -34.8811),
    ("jaboatao dos guararapes", "PE"): (-8.1131, -35.0147),
    ("olinda", "PE"): (-7.9994, -34.8452),
    ("caruaru", "PE"): (-8.2824, -35.9761),
    ("petrolina", "PE"): (-9.3986, -40.5078),
    ("paulista", "PE"): (-7.9406, -34.8722),
    ("camaragibe", "PE"): (-8.0228, -34.9878),
    ("cabo de santo agostinho", "PE"): (-8.2894, -35.0347),
    ("garanhuns", "PE"): (-8.8899, -36.4978),
    # MA
    ("sao luis", "MA"): (-2.5297, -44.3028),
    ("imperatriz", "MA"): (-5.5258, -47.4783),
    ("sao jose de ribamar", "MA"): (-2.5611, -44.0547),
    ("timon", "MA"): (-5.0942, -42.8333),
    ("caxias", "MA"): (-4.8597, -43.3553),
    # PA
    ("belem", "PA"): (-1.4558, -48.5044),
    ("ananindeua", "PA"): (-1.3656, -48.3722),
    ("santarem", "PA"): (-2.4367, -54.7082),
    ("maraba", "PA"): (-5.3689, -49.1178),
    ("castanhal", "PA"): (-1.2939, -47.9261),
    # AM
    ("manaus", "AM"): (-3.1019, -60.0250),
    ("parintins", "AM"): (-2.6286, -56.7358),
    ("itacoatiara", "AM"): (-3.1428, -58.4444),
    # RN
    ("natal", "RN"): (-5.7945, -35.2110),
    ("mossoró", "RN"): (-5.1878, -37.3439),
    ("mossoro", "RN"): (-5.1878, -37.3439),
    ("parnamirim", "RN"): (-5.9150, -35.2636),
    ("caicó", "RN"): (-6.4581, -37.0975),
    ("caico", "RN"): (-6.4581, -37.0975),
    # PB
    ("joao pessoa", "PB"): (-7.1195, -34.8450),
    ("campina grande", "PB"): (-7.2306, -35.8811),
    ("patos", "PB"): (-7.0228, -37.2811),
    ("bayeux", "PB"): (-7.1253, -34.9236),
    # AL
    ("maceio", "AL"): (-9.6658, -35.7350),
    ("arapiraca", "AL"): (-9.7547, -36.6611),
    ("palmeira dos indios", "AL"): (-9.4086, -36.6333),
    # SE
    ("aracaju", "SE"): (-10.9472, -37.0731),
    ("nossa senhora do socorro", "SE"): (-10.8553, -37.1261),
    ("lagarto", "SE"): (-10.9153, -37.6481),
    # PI
    ("teresina", "PI"): (-5.0892, -42.8019),
    ("parnaiba", "PI"): (-2.9044, -41.7761),
    ("picos", "PI"): (-7.0772, -41.4681),
    # MT
    ("cuiaba", "MT"): (-15.6014, -56.0979),
    ("varzea grande", "MT"): (-15.6469, -56.1325),
    ("rondonopolis", "MT"): (-16.4681, -54.6381),
    ("sinop", "MT"): (-11.8644, -55.5097),
    ("tangara da serra", "MT"): (-14.6228, -57.4961),
    # MS
    ("campo grande", "MS"): (-20.4697, -54.6201),
    ("dourados", "MS"): (-22.2211, -54.8122),
    ("tres lagoas", "MS"): (-20.7511, -51.7011),
    ("corumba", "MS"): (-19.0078, -57.6536),
    # RO
    ("porto velho", "RO"): (-8.7619, -63.9039),
    ("ji-parana", "RO"): (-10.8853, -61.9525),
    ("ji parana", "RO"): (-10.8853, -61.9525),
    ("ariquemes", "RO"): (-9.9133, -63.0386),
    # TO
    ("palmas", "TO"): (-10.2491, -48.3243),
    ("araguaina", "TO"): (-7.1917, -48.2078),
    ("gurupi", "TO"): (-11.7297, -49.0686),
    # AC
    ("rio branco", "AC"): (-9.9753, -67.8100),
    ("cruzeiro do sul", "AC"): (-7.6281, -72.6736),
    # AP
    ("macapa", "AP"): (0.0356, -51.0705),
    ("santana", "AP"): (-0.0581, -51.1794),
    # RR
    ("boa vista", "RR"): (2.8197, -60.6733),
}

def _norm_cidade(s: str) -> str:
    """Remove acentos, lowercase, strip."""
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()

# Cache em memória para lookups IBGE (evita repetir requisição para mesma cidade)
_ibge_cache: dict[tuple[str, str], tuple[float, float] | None] = {}

def _geocode_ibge(cidade: str, uf: str) -> tuple[float, float] | None:
    """Busca coordenadas via Nominatim/OSM com cache em memória. Fire-and-forget friendly."""
    import httpx as _httpx
    key = (_norm_cidade(cidade), uf)
    if key in _ibge_cache:
        return _ibge_cache[key]
    try:
        resp = _httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": f"{cidade}, {uf}, Brazil", "format": "json", "limit": 1},
            headers={"User-Agent": "criarecrm-mapa/1.0"},
            timeout=4,
        )
        data = resp.json()
        if data:
            coords: tuple[float, float] = (float(data[0]["lat"]), float(data[0]["lon"]))
            _ibge_cache[key] = coords
            return coords
    except Exception:
        pass
    _ibge_cache[key] = None
    return None

def _get_coords_cidade(cidade: str, uf: str) -> tuple[tuple[float, float], bool]:
    """Retorna (lat, lng), coordenada_real.
    1º: dict estático (fast path)
    2º: Nominatim/OSM (fallback dinâmico, com cache)
    3º: centróide do estado
    """
    if not cidade or not uf:
        return ESTADO_CENTROIDES.get(uf, (-14.5, -51.5)), False
    key = (_norm_cidade(cidade), uf)
    if key in CIDADES_COORDS:
        return CIDADES_COORDS[key], True
    coords = _geocode_ibge(cidade, uf)
    if coords:
        return coords, True
    return ESTADO_CENTROIDES.get(uf, (-14.5, -51.5)), False

def _normalizar_tipo(t: str) -> str:
    """Converte 'instalacao_sia_pdv' → busca no TIPO_LABEL; fallback: humaniza."""
    if t in TIPO_LABEL:
        return TIPO_LABEL[t]
    # Remove prefixo instalacao_ e humaniza
    chave = t.replace("instalacao_", "").replace("_", " ").title()
    return chave or t

def _parse_tipos(inst: Instalacao) -> list[str]:
    raw = inst.tipos_json
    if not raw:
        return [inst.tipo] if inst.tipo else []
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        return parsed if isinstance(parsed, list) else [inst.tipo]
    except Exception:
        return [inst.tipo] if inst.tipo else []

def _get_estado(cliente: Cliente | None) -> str:
    if not cliente or not cliente.endereco:
        return ""
    end = cliente.endereco if isinstance(cliente.endereco, dict) else {}
    return (end.get("estado") or "").upper().strip()

def _get_cidade(cliente: Cliente | None) -> str:
    if not cliente or not cliente.endereco:
        return ""
    end = cliente.endereco if isinstance(cliente.endereco, dict) else {}
    return (end.get("cidade") or "").strip()

def _desde(periodo_dias: int) -> date:
    return date.today() - timedelta(days=periodo_dias)

def _mes_label(d: date) -> str:
    meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
    return f"{meses[d.month - 1]}/{str(d.year)[2:]}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/visao-geral")
def visao_geral(
    periodo_dias: int = Query(365),
    estado: str = Query(""),
    consultor: str = Query(""),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    implantacoes = db.execute(
        select(Implantacao)
        .options(selectinload(Implantacao.cliente))
        .where(Implantacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    instalacoes = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.cliente))
        .where(Instalacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    clientes = db.execute(select(Cliente)).scalars().all()

    if estado:
        implantacoes = [i for i in implantacoes if _get_estado(i.cliente) == estado.upper()]
        instalacoes  = [i for i in instalacoes  if _get_estado(i.cliente) == estado.upper()]
        clientes     = [c for c in clientes      if _get_estado(c) == estado.upper()]

    if consultor:
        implantacoes = [i for i in implantacoes if consultor.lower() in (i.consultor or "").lower()]

    impl_concluidas = sum(1 for i in implantacoes if i.status == "concluida")
    impl_andamento  = sum(1 for i in implantacoes if i.status == "em_andamento")
    impl_pausadas   = sum(1 for i in implantacoes if i.status == "pausada")
    inst_concluidas = sum(1 for i in instalacoes  if i.status == "concluida")
    inst_pendentes  = sum(1 for i in instalacoes  if i.status in ("agendada", "em_execucao"))

    # Denominador exclui canceladas — cancelado não representa trabalho a concluir
    total_ativos = (impl_concluidas + impl_andamento + impl_pausadas) + (inst_concluidas + inst_pendentes)
    finalizados  = impl_concluidas + inst_concluidas
    taxa = round(finalizados / total_ativos * 100, 1) if total_ativos > 0 else 0.0

    hoje = date.today()
    ini_mes  = hoje.replace(day=1)
    ini_ant  = (ini_mes - timedelta(days=1)).replace(day=1)
    mes_atual  = sum(1 for i in implantacoes if i.created_at.date() >= ini_mes)
    mes_passado = sum(1 for i in implantacoes if ini_ant <= i.created_at.date() < ini_mes)
    crescimento = round((mes_atual - mes_passado) / mes_passado * 100, 1) if mes_passado > 0 else 0.0

    return {
        "total_clientes":          len(clientes),
        "implantacoes_concluidas": impl_concluidas,
        "implantacoes_andamento":  impl_andamento,
        "implantacoes_pausadas":   impl_pausadas,
        "instalacoes_concluidas":  inst_concluidas,
        "instalacoes_pendentes":   inst_pendentes,
        "taxa_conclusao":          taxa,
        "crescimento_mensal":      crescimento,
    }


def _mes_range(hoje: date, meses_atras: int) -> tuple[date, date]:
    """Retorna (primeiro_dia, primeiro_dia_mes_seguinte) para N meses atrás."""
    mes = hoje.month - meses_atras
    ano = hoje.year
    while mes <= 0:
        mes += 12
        ano -= 1
    ref  = date(ano, mes, 1)
    prox = date(ano + 1, 1, 1) if mes == 12 else date(ano, mes + 1, 1)
    return ref, prox


@router.get("/evolucao-mensal")
def evolucao_mensal(
    periodo_dias: int = Query(365),
    estado: str = Query(""),
    db: Session = Depends(get_db),
):
    hoje = date.today()
    # Mapeia período para quantidade de buckets mensais exibidos
    meses = 3 if periodo_dias <= 90 else 6 if periodo_dias <= 180 else 12

    # Cutoff com margem extra para pegar conclusões de registros criados antes do período
    cutoff = datetime.combine(hoje - timedelta(days=periodo_dias + 60), datetime.min.time())

    # Carrega somente registros relevantes ao período; exclui cancelados
    impl_all = db.execute(
        select(Implantacao)
        .options(selectinload(Implantacao.cliente))
        .where(
            Implantacao.status != "cancelada",
            or_(
                Implantacao.created_at >= cutoff,
                Implantacao.data_conclusao >= cutoff.date(),
            ),
        )
    ).scalars().all()

    inst_all = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.cliente))
        .where(
            Instalacao.status != "cancelada",
            or_(
                Instalacao.created_at >= cutoff,
                Instalacao.data_conclusao >= cutoff.date(),
            ),
        )
    ).scalars().all()

    if estado:
        uf = estado.upper()
        impl_all = [x for x in impl_all if _get_estado(x.cliente) == uf]
        inst_all = [x for x in inst_all if _get_estado(x.cliente) == uf]

    resultado = []
    for i in range(meses - 1, -1, -1):
        ref, prox = _mes_range(hoje, i)

        impl_criadas = sum(1 for x in impl_all if ref <= x.created_at.date() < prox)
        inst_criadas = sum(1 for x in inst_all if ref <= x.created_at.date() < prox)

        impl_concl = sum(
            1 for x in impl_all
            if x.data_conclusao and ref <= x.data_conclusao < prox and x.status == "concluida"
        )
        inst_concl = sum(
            1 for x in inst_all
            if x.data_conclusao and ref <= x.data_conclusao < prox and x.status == "concluida"
        )

        resultado.append({
            "mes":             _mes_label(ref),
            "implantacoes":    impl_criadas,
            "instalacoes":     inst_criadas,
            "impl_concluidas": impl_concl,
            "inst_concluidas": inst_concl,
        })

    return resultado


@router.get("/equipe")
def equipe(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    instalacoes = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.responsavel))
        .where(
            Instalacao.created_at >= datetime.combine(desde, datetime.min.time()),
            Instalacao.responsavel_id.isnot(None),
        )
    ).scalars().all()

    usuarios = db.execute(select(Usuario).where(Usuario.ativo == True)).scalars().all()
    users_map = {u.id: u for u in usuarios}

    por_tecnico: dict[int, dict] = {}
    for inst in instalacoes:
        uid = inst.responsavel_id
        if uid not in por_tecnico:
            nome = users_map.get(uid, inst.responsavel)
            por_tecnico[uid] = {
                "id": uid,
                "nome": nome.nome if hasattr(nome, "nome") else str(nome),
                "avatar_url": nome.avatar_url if hasattr(nome, "avatar_url") else None,
                "total": 0, "concluidas": 0, "em_execucao": 0,
                "tempo_medio_min": 0, "_tempos": [],
            }
        por_tecnico[uid]["total"] += 1
        if inst.status == "concluida":
            por_tecnico[uid]["concluidas"] += 1
            if inst.duracao_minutos:
                por_tecnico[uid]["_tempos"].append(inst.duracao_minutos)
        elif inst.status == "em_execucao":
            por_tecnico[uid]["em_execucao"] += 1

    result = []
    for entry in por_tecnico.values():
        tempos = entry.pop("_tempos")
        entry["tempo_medio_min"] = round(sum(tempos) / len(tempos)) if tempos else 0
        entry["taxa_conclusao"] = round(entry["concluidas"] / entry["total"] * 100, 1) if entry["total"] else 0
        result.append(entry)

    # 1º critério: mais conclusões; 2º (empate): menor tempo médio
    result.sort(key=lambda x: (-x["concluidas"], x["tempo_medio_min"] if x["tempo_medio_min"] > 0 else 999999))
    for i, r in enumerate(result):
        r["ranking"] = i + 1

    return result


@router.get("/produtos")
def produtos(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    instalacoes = db.execute(
        select(Instalacao).where(
            Instalacao.created_at >= datetime.combine(desde, datetime.min.time()),
            Instalacao.status != "cancelada",
        )
    ).scalars().all()

    contagem: dict[str, dict] = {}
    for inst in instalacoes:
        tipos = _parse_tipos(inst)
        for t in tipos:
            chave = _normalizar_tipo(t)
            if chave not in contagem:
                contagem[chave] = {"produto": chave, "total": 0, "concluidas": 0, "tempos": []}
            contagem[chave]["total"] += 1
            if inst.status == "concluida":
                contagem[chave]["concluidas"] += 1
                if inst.duracao_minutos:
                    contagem[chave]["tempos"].append(inst.duracao_minutos)

    result = []
    for entry in contagem.values():
        tempos = entry.pop("tempos")
        entry["tempo_medio_min"] = round(sum(tempos) / len(tempos)) if tempos else 0
        entry["taxa_conclusao"] = round(entry["concluidas"] / entry["total"] * 100, 1) if entry["total"] else 0
        result.append(entry)

    result.sort(key=lambda x: x["total"], reverse=True)
    return result


@router.get("/por-estado")
def por_estado(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    clientes = db.execute(select(Cliente)).scalars().all()

    implantacoes = db.execute(
        select(Implantacao)
        .options(selectinload(Implantacao.cliente))
        .where(Implantacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    instalacoes = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.cliente))
        .where(Instalacao.created_at >= datetime.combine(desde, datetime.min.time()))
    ).scalars().all()

    por_uf: dict[str, dict] = {}

    for c in clientes:
        uf = _get_estado(c) or "N/A"
        if uf not in por_uf:
            por_uf[uf] = {"estado": uf, "clientes": 0, "implantacoes": 0, "instalacoes": 0, "concluidas": 0}
        por_uf[uf]["clientes"] += 1

    for i in implantacoes:
        uf = _get_estado(i.cliente) or "N/A"
        if uf not in por_uf:
            por_uf[uf] = {"estado": uf, "clientes": 0, "implantacoes": 0, "instalacoes": 0, "concluidas": 0}
        por_uf[uf]["implantacoes"] += 1
        if i.status == "concluida":
            por_uf[uf]["concluidas"] += 1

    for i in instalacoes:
        uf = _get_estado(i.cliente) or "N/A"
        if uf not in por_uf:
            por_uf[uf] = {"estado": uf, "clientes": 0, "implantacoes": 0, "instalacoes": 0, "concluidas": 0}
        por_uf[uf]["instalacoes"] += 1

    result = sorted(por_uf.values(), key=lambda x: x["clientes"], reverse=True)
    return result


_STATUS_INST = {
    "agendada":    "em_andamento",
    "em_execucao": "em_andamento",
    "concluida":   "concluida",
    "cancelada":   "cancelada",
}

@router.get("/clientes-mapa")
def clientes_mapa(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)
    desde_dt = datetime.combine(desde, datetime.min.time())

    implantacoes = db.execute(
        select(Implantacao)
        .options(selectinload(Implantacao.cliente))
        .where(
            Implantacao.created_at >= desde_dt,
            Implantacao.status != "cancelada",
        )
    ).scalars().all()

    instalacoes = db.execute(
        select(Instalacao)
        .options(selectinload(Instalacao.cliente))
        .where(
            Instalacao.created_at >= desde_dt,
            Instalacao.status != "cancelada",
        )
    ).scalars().all()

    result = []

    for impl in implantacoes:
        c = impl.cliente
        if not c:
            continue
        uf = _get_estado(c)
        cidade = _get_cidade(c)
        coords, coord_real = _get_coords_cidade(cidade, uf)
        result.append({
            "id":             f"impl_{impl.id}",
            "cliente_id":     c.id,
            "cliente_nome":   c.razao_social,
            "cidade":         cidade,
            "estado":         uf,
            "lat":            round(coords[0], 5),
            "lng":            round(coords[1], 5),
            "status":         impl.status,
            "tipo":           "implantacao",
            "consultor":      impl.consultor or "",
            "data_prevista":  impl.data_prevista.isoformat() if impl.data_prevista else None,
            "progresso":      impl.progresso,
            "sla_status":     impl.sla_status,
            "coordenada_real": coord_real,
        })

    for inst in instalacoes:
        c = inst.cliente
        if not c:
            continue
        uf = _get_estado(c)
        cidade = _get_cidade(c)
        coords, coord_real = _get_coords_cidade(cidade, uf)
        result.append({
            "id":             f"inst_{inst.id}",
            "cliente_id":     c.id,
            "cliente_nome":   c.razao_social,
            "cidade":         cidade,
            "estado":         uf,
            "lat":            round(coords[0], 5),
            "lng":            round(coords[1], 5),
            "status":         _STATUS_INST.get(inst.status, "em_andamento"),
            "tipo":           "instalacao",
            "consultor":      inst.consultor or "",
            "data_prevista":  inst.data_agendada.isoformat() if inst.data_agendada else None,
            "progresso":      inst.progresso,
            "sla_status":     None,
            "coordenada_real": coord_real,
        })

    return result


@router.get("/debug-mapa")
def debug_mapa(db: Session = Depends(get_db)):
    """Endpoint temporário para diagnosticar geocoding. Mostra cidade/UF lida do banco."""
    desde_dt = datetime.combine(_desde(365), datetime.min.time())
    rows = []
    for inst in db.execute(
        select(Instalacao).options(selectinload(Instalacao.cliente))
        .where(Instalacao.created_at >= desde_dt)
        .limit(20)
    ).scalars():
        c = inst.cliente
        cidade = _get_cidade(c) if c else ""
        uf = _get_estado(c) if c else ""
        coords, real = _get_coords_cidade(cidade, uf)
        rows.append({
            "id": inst.id, "status": inst.status, "cliente": c.razao_social if c else None,
            "cidade_lida": cidade, "uf_lida": uf,
            "lat": coords[0], "lng": coords[1], "coordenada_real": real,
            "endereco_raw": c.endereco if c else None,
        })
    return rows


@router.get("/por-consultor")
def por_consultor(
    periodo_dias: int = Query(365),
    db: Session = Depends(get_db),
):
    desde = _desde(periodo_dias)

    implantacoes = db.execute(
        select(Implantacao).where(
            Implantacao.created_at >= datetime.combine(desde, datetime.min.time()),
            Implantacao.consultor.isnot(None),
        )
    ).scalars().all()

    por_consultor: dict[str, dict] = {}
    for impl in implantacoes:
        nome = (impl.consultor or "Sem consultor").strip()
        if nome not in por_consultor:
            por_consultor[nome] = {"consultor": nome, "total": 0, "concluidas": 0, "andamento": 0, "progresso_medio": []}
        por_consultor[nome]["total"] += 1
        if impl.status == "concluida":
            por_consultor[nome]["concluidas"] += 1
        elif impl.status == "em_andamento":
            por_consultor[nome]["andamento"] += 1
        por_consultor[nome]["progresso_medio"].append(impl.progresso or 0)

    result = []
    for entry in por_consultor.values():
        progs = entry.pop("progresso_medio")
        entry["progresso_medio"] = round(sum(progs) / len(progs)) if progs else 0
        entry["taxa_conclusao"] = round(entry["concluidas"] / entry["total"] * 100, 1) if entry["total"] else 0
        result.append(entry)

    result.sort(key=lambda x: x["total"], reverse=True)
    return result
