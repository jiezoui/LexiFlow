# -*- coding: utf-8 -*-
"""
Seed three categories of wordbooks:
1. COLLOQUIAL (日常高频口语)
2. PROFESSIONAL (行业专业)
3. ACADEMIC (学术科研)
"""

import csv
import json
import os
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

# 1. AWL 570 words (Academic Word List official headwords)
AWL_WORDS = [
    # Sublist 1
    "analyse", "approach", "area", "assess", "assume", "authority", "available", "benefit", "concept", "consist",
    "constitute", "context", "contract", "create", "data", "define", "derive", "distribute", "economy", "environment",
    "establish", "estimate", "evident", "export", "factor", "finance", "formula", "function", "identify", "income",
    "indicate", "individual", "interpret", "involve", "issue", "labour", "legal", "legislate", "major", "method",
    "occur", "percent", "period", "policy", "principle", "proceed", "process", "require", "research", "respond",
    "role", "section", "sector", "significant", "similar", "source", "specific", "structure", "theory", "vary",
    # Sublist 2
    "achieve", "acquire", "administrate", "affect", "appropriate", "aspect", "assist", "category", "chapter", "commission",
    "commit", "community", "complex", "compute", "conclude", "conduct", "consequent", "construct", "consume", "credit",
    "culture", "design", "distinct", "element", "equate", "evaluate", "feature", "final", "focus", "impact",
    "injure", "institute", "invest", "item", "journal", "maintain", "normal", "obtain", "participate", "perceive",
    "positive", "potential", "previous", "primary", "purchase", "range", "region", "regulate", "relevant", "reside",
    "resource", "restrict", "secure", "seek", "select", "site", "strategy", "survey", "text", "tradition", "transfer",
    # Sublist 3
    "alternative", "circumstance", "comment", "compensate", "component", "consent", "considerable", "constant", "constrain", "contribute",
    "convene", "coordinate", "core", "corporate", "correspond", "criteria", "deduce", "demonstrate", "document", "dominate",
    "emphasis", "ensure", "exclude", "framework", "fund", "illustrate", "immigrate", "imply", "initial", "instance",
    "interact", "justify", "layer", "link", "locate", "maximise", "minor", "negate", "outcome", "partner",
    "philosophy", "physical", "proportion", "publish", "react", "register", "rely", "remove", "scheme", "sequence",
    "shift", "specify", "sufficient", "task", "technical", "technique", "technology", "valid", "volume",
    # Sublist 4
    "access", "adequate", "annual", "apparent", "approximate", "attitude", "attribute", "civil", "code", "communicate",
    "concentrate", "confer", "contrast", "cycle", "debate", "despite", "dimension", "domestic", "emerge", "error",
    "ethnic", "goal", "grant", "hence", "hypothesis", "implement", "implicate", "impose", "integrate", "internal",
    "investigate", "job", "label", "mechanism", "obvious", "occupy", "option", "output", "overall", "parallel",
    "parameter", "phase", "predict", "principal", "prior", "professional", "project", "promote", "regime", "resolve",
    "retain", "series", "statistic", "status", "stress", "subsequent", "sum", "summary", "undertake",
    # Sublist 5
    "academy", "adjust", "alter", "amend", "aware", "capacity", "challenge", "clause", "compound", "conflict",
    "consult", "contact", "decline", "discrete", "draft", "enable", "energy", "enforce", "entity", "exceed",
    "expand", "expose", "external", "facilitate", "fundamental", "generate", "generation", "image", "liberal", "licence",
    "logic", "margin", "medical", "mental", "modify", "monitor", "network", "notion", "objective", "orient",
    "perspective", "precise", "prime", "psychology", "pursue", "ratio", "reject", "revenue", "stable", "style",
    "substitute", "sustain", "symbol", "target", "transit", "trend", "version", "welfare", "whereas",
    # Sublist 6
    "abstract", "accurate", "acknowledge", "aggregate", "allocate", "assign", "attach", "author", "bond", "brief",
    "capable", "cite", "cooperate", "discriminate", "display", "diverse", "domain", "edit", "enhance", "estate",
    "expert", "explicit", "federal", "fee", "flexible", "furthermore", "gender", "ignorant", "incentive", "incorporate",
    "index", "inhibit", "initiate", "input", "instruct", "intelligence", "interval", "lecture", "migrate", "minimum",
    "ministry", "motive", "neutral", "nevertheless", "overseas", "precede", "rational", "recover", "reveal", "scope",
    "subsidy", "tape", "trace", "transform", "transport", "underlie", "utilise",
    # Sublist 7
    "adapt", "adult", "advocate", "aid", "channel", "chemical", "classic", "comprehensive", "comprise", "confirm",
    "contrary", "convert", "couple", "decade", "definite", "deny", "differentiate", "dispose", "dynamic", "eliminate",
    "empirical", "equip", "extract", "file", "finite", "foundation", "globe", "grade", "guarantee", "hierarchy",
    "identical", "ideology", "infer", "innovate", "insert", "intervene", "isolate", "media", "mode", "paradigm",
    "phenomenon", "priority", "prohibit", "publication", "quote", "release", "reverse", "simulate", "sole", "somewhat",
    "submit", "successor", "survive", "thesis", "topic", "transmit", "ultimate", "unique", "visible", "voluntary",
    # Sublist 8
    "abandon", "accompany", "accumulate", "ambiguous", "appease", "append", "appreciate", "arbitrary", "automate", "bias",
    "chart", "clarify", "commodity", "complement", "conform", "contemporary", "contradict", "crucial", "currency", "denote",
    "detect", "deviate", "displace", "drama", "eventual", "exhibit", "exploit", "fluctuate", "guideline", "highlight",
    "implicit", "induce", "inevitable", "infrastructure", "inspect", "intense", "manipulate", "minimise", "nuclear", "offset",
    "paragraph", "practitioner", "predominant", "prospect", "radical", "random", "reinforce", "restore", "revise", "schedule",
    "tense", "terminate", "theme", "thereby", "uniform", "vehicle", "via", "virtual", "widespread",
    # Sublist 9
    "accommodate", "analogy", "anticipate", "assure", "attain", "behalf", "cease", "coherent", "coincide", "commence",
    "compile", "concur", "confine", "controversy", "converse", "depress", "distort", "duration", "erosion", "ethic",
    "format", "founded", "incline", "inherent", "insight", "integral", "intermediate", "manual", "mature", "mediate",
    "medium", "military", "minimal", "mutual", "norm", "overlap", "passive", "portion", "preliminary", "protocol",
    "qualitative", "refine", "relax", "restrain", "revolution", "rigid", "route", "scenario", "sphere", "subordinate",
    "supplement", "suspend", "temporary", "trigger", "unify", "violate", "vision",
    # Sublist 10
    "adjacent", "albeit", "assemble", "collapse", "colleague", "conceive", "convince", "encounter", "forthcoming", "integrity",
    "intrinsic", "invoke", "levy", "likewise", "nonetheless", "notwithstanding", "ongoing", "panel", "persist", "pose",
    "reluctance", "straightforward", "undergo", "whereby"
]

# 2. ACADEMIC Research & Thesis Writing (~300 words)
ACADEMIC_RESEARCH_WORDS = [
    "hypothesis", "methodology", "empirical", "paradigm", "qualitative", "quantitative", "synthesize", "correlate",
    "causality", "phenomenon", "variable", "discrepancy", "extrapolate", "replicate", "corroborate", "substantiate",
    "refute", "validate", "generalize", "postulate", "deduce", "induce", "systematic", "statistically", "longitudinal",
    "cohort", "control", "baseline", "benchmark", "discourse", "epistemology", "hermeneutic", "interdisciplinary",
    "taxonomy", "trajectory", "heterogeneous", "homogeneous", "ubiquitous", "preliminary", "supplementary", "exhaustive",
    "feasible", "plausible", "rigorous", "robust", "comprehensive", "intrinsic", "extrinsic", "concomitant", "dichotomy",
    "implication", "manifestation", "underlying", "predominant", "salient", "paramount", "crucial", "pivotal", "imperative",
    "precursor", "anomaly", "deviation", "fluctuation", "equilibrium", "convergence", "divergence", "stochastic",
    "deterministic", "probabilistic", "asymptotic", "hierarchical", "multidimensional", "orthogonal", "holistic",
    "atomistic", "heuristic", "teleological", "ontological", "axiomatic", "nuance", "premise", "caveat", "corollary",
    "synthesis", "antithesis", "dialectic", "ontology", "phenomenology", "positivism", "pragmatism", "rationalism",
    "empiricism", "reductionism", "determinism", "pluralism", "relativism", "universalism", "contextualize",
    "operationalize", "conceptualize", "differentiate", "delineate", "articulate", "disaggregate", "elucidate",
    "underscore", "exemplify", "reiterate", "repudiate", "interrogate", "foreground", "problematize", "critique",
    "evaluate", "appraise", "quantify", "calibrate", "invalidate", "nullify", "verify", "authenticate", "speculate",
    "assert", "contend", "stipulate", "concede", "diverge", "contravene", "encapsulate", "epitomize", "instantiate",
    "illuminate", "expound", "scrutinize", "probe", "dissect", "distill", "infer", "theorize", "model", "simulate",
    "formalize", "standardize", "harmonize", "reconcile", "arbitrate", "disprove", "undermine", "contest", "transcend",
    "amalgamate", "coalesce", "bifurcate", "oscillate", "stabilize", "stagnate", "proliferate", "escalate", "diminish",
    "attenuate", "exacerbate", "mitigate", "alleviate", "precipitate", "catalyze", "expedite", "impede", "obstruct",
    "stifle", "perpetuate", "dismantle", "erode", "eclipse", "foreshadow", "prefigure", "herald", "mirror", "surpass",
    "outstrip", "augment", "curtail", "constrain", "circumscribe", "boundary", "continuum", "nexus", "matrix",
    "configuration", "typology", "schema", "rubric", "feedback", "mechanism", "pathway", "conduit", "apparatus",
    "instrument", "regimen", "artifact", "outlier", "confounder", "covariate", "dispersion", "distribution",
    "probability", "prevalence", "incidence", "proportion", "coefficient", "inflection", "asymptote", "domain",
    "census", "stratum", "cluster", "variance", "correlation", "regression", "significance", "confidence", "interval",
    "probability", "robustness", "validity", "reliability", "generalizability", "replicability", "reproducibility",
    "triangulation", "saturation", "inductive", "deductive", "abductive", "grounded", "heuristic", "longitudinal",
    "cross-sectional", "retrospective", "prospective", "observational", "experimental", "quasi-experimental",
    "randomized", "double-blind", "placebo", "attrition", "confounding", "moderator", "mediator", "latent",
    "manifest", "indicator", "construct", "operationalization", "measurement", "psychometric", "validity"
]

# 3. COLLOQUIAL - Spoken English from Movies/TV Series (500 words)
COLLOQUIAL_TV_WORDS = [
    "awesome", "hilarious", "ridiculous", "awkward", "weird", "chill", "freak", "hangout", "bother", "mess",
    "grab", "stuff", "figure", "guess", "bet", "fancy", "crappy", "bizarre", "nuts", "silly",
    "buddy", "kidding", "darn", "clumsy", "sneaky", "touchy", "grouchy", "spooky", "creepy", "bummer",
    "dude", "folks", "yummy", "nasty", "gross", "snack", "brunch", "couch", "cozy", "neat",
    "cheers", "reckon", "screw", "dump", "smug", "vibe", "hype", "cringe", "binge", "hangover",
    "crush", "jealous", "annoying", "blunt", "subtle", "sarcastic", "witty", "dork", "geek", "nerd",
    "gossip", "rumor", "confess", "flirt", "apologize", "forgive", "blame", "excuse", "panic", "hesitate",
    "stroll", "wander", "rush", "flee", "sneak", "toss", "slam", "shrug", "nod", "gasp",
    "sigh", "stare", "glance", "peek", "blink", "whisper", "mutter", "yell", "scream", "groan",
    "whine", "giggle", "chuckle", "sob", "weep", "tease", "mock", "trick", "fool", "ditch",
    "cheat", "betray", "swear", "curse", "hug", "cuddle", "snuggle", "poke", "slap", "punch",
    "kick", "trip", "spill", "slip", "crawl", "stumble", "stagger", "leap", "hop", "skip",
    "drag", "tug", "shove", "nudge", "snatch", "fling", "flick", "smash", "crash", "bump",
    "bang", "snap", "crack", "pop", "fizz", "buzz", "hiss", "click", "tick", "splash",
    "drip", "leak", "soak", "wipe", "scrub", "sweep", "tidy", "polish", "shine", "sparkle",
    "glow", "flicker", "flash", "dim", "faint", "blur", "dizzy", "numb", "sore", "ache",
    "itch", "scratch", "pinch", "squeeze", "bruise", "scar", "heal", "bleed", "shiver", "tremble",
    "shudder", "sweat", "breathe", "choke", "cough", "sneeze", "yawn", "snore", "swallow", "chew",
    "bite", "lick", "sip", "gulp", "feast", "crave", "starve", "thirsty", "stuffed", "exhausted",
    "weary", "restless", "frantic", "furious", "ecstatic", "thrilled", "overjoyed", "gloomy", "dreary", "miserable",
    "wretched", "lonely", "homesick", "heartbroken", "devastated", "desperate", "helpless", "anxious", "uneasy", "tense",
    "nervous", "edgy", "jumpy", "scared", "terrified", "horrified", "astonished", "stunned", "baffled", "puzzled",
    "bewildered", "clueless", "doubtful", "skeptical", "cynical", "stubborn", "obstinate", "arrogant", "boastful", "proud",
    "humble", "modest", "polite", "courteous", "rude", "impudent", "brazen", "shy", "timid", "bashful",
    "bold", "brave", "courageous", "daring", "reckless", "careless", "gentle", "tender", "kind", "compassionate",
    "sympathetic", "cruel", "ruthless", "fierce", "brutal", "harsh", "severe", "strict", "stern", "lenient",
    "tolerant", "generous", "greedy", "stingy", "miserly", "selfish", "selfless", "loyal", "faithful", "treacherous",
    "deceitful", "honest", "sincere", "genuine", "fake", "phony", "hypocrite", "shallow", "superficial", "profound",
    "wise", "foolish", "naive", "innocent", "guilty", "wicked", "evil", "saintly", "righteous", "charming",
    "lovely", "cute", "pretty", "handsome", "hideous", "ugly", "filthy", "spotless", "shabby", "ragged",
    "worn", "rusty", "glossy", "dull", "bright", "vivid", "pale", "colorful", "dark", "shady",
    "sunny", "chilly", "breezy", "stormy", "foggy", "misty", "humid", "damp", "sticky", "dusty",
    "muddy", "greasy", "oily", "slippery", "rough", "smooth", "silky", "fluffy", "woolly", "furry",
    "crispy", "crunchy", "chewy", "tough", "soggy", "stale", "rotten", "ripe", "fresh", "sour",
    "bitter", "sweet", "salty", "spicy", "savory", "blend", "mix", "stir", "whisk", "peel",
    "slice", "chop", "dice", "mince", "grate", "boil", "simmer", "roast", "bake", "grill",
    "fry", "toast", "steam", "brew", "pour", "serve", "taste", "savor", "devour", "crunch",
    "nibble", "gobble", "gorge", "quench", "digest", "leftover", "recipe", "ingredient", "flavor", "aroma",
    "scent", "odor", "stench", "perfume", "fragrance", "echo", "rhythm", "tempo", "melody", "harmony",
    "tune", "beat", "chord", "solo", "chorus", "noise", "racket", "uproar", "clamor", "silence",
    "pause", "delay", "hurry", "haste", "sprint", "trek", "hike", "roam", "detour", "commute",
    "voyage", "journey", "luggage", "baggage", "suitcase", "backpack", "parcel", "package", "ticket", "passport",
    "visa", "border", "customs", "transit", "departure", "arrival", "delayed", "canceled", "boarded", "runway",
    "cockpit", "cabin", "terminal", "platform", "subway", "shuttle", "taxi", "fare", "highway", "freeway",
    "alley", "lane", "avenue", "sidewalk", "curb", "crosswalk", "intersection", "roundabout", "traffic", "congestion",
    "parking", "garage", "meter", "fine", "penalty", "license", "permit", "vehicle", "engine", "wheel",
    "tire", "brake", "clutch", "gear", "steering", "windshield", "wiper", "bumper", "trunk", "hood",
    "mirror", "headlight", "honk", "steer", "accelerate", "skid", "collide", "wreck", "tow", "repair",
    "mechanic", "spare", "toolkit", "wrench", "hammer", "nail", "bolt", "nut", "drill", "saw",
    "pliers", "glue", "wire", "rope", "cord", "string", "knot", "loop", "hook", "latch",
    "hinge", "knob", "handle", "switch", "socket", "plug", "battery", "charger", "bulb", "fuse",
    "spark", "current", "voltage", "signal", "antenna", "gadget", "device", "appliance", "equipment", "outfit",
    "attire", "garment", "fabric", "cloth", "cotton", "wool", "silk", "linen", "leather", "denim",
    "fleece", "velvet", "lace", "ribbon", "thread", "needle", "stitch", "sew", "knit", "patch",
    "mend", "iron", "fold", "wrinkle", "stain", "dirt", "dust", "lint", "laundry", "wash",
    "rinse", "wring", "hang", "dry", "bleach", "detergent", "soap", "foam", "bubble", "sponge",
    "towel", "mop", "broom", "brush", "dustpan", "vacuum", "trash", "garbage", "rubbish", "junk",
    "clutter", "disposal", "recycle", "bin", "crate", "barrel", "bucket", "jar", "bottle", "flask",
    "jug", "pitcher", "kettle", "mug", "saucer", "bowl", "plate", "dish", "tray", "fork",
    "spoon", "knife", "blade", "napkin", "tablecloth"
]

# 4. COLLOQUIAL - Daily Practical Social & Travel (~300 words)
COLLOQUIAL_LIFE_WORDS = [
    "reservation", "accommodation", "hospitality", "reception", "concierge", "check-in", "checkout", "itinerary",
    "sightseeing", "attraction", "souvenir", "landmark", "breathtaking", "picturesque", "scenic", "excursion",
    "brochure", "pedestrian", "stroller", "elevator", "escalator", "staircase", "basement", "attic", "balcony",
    "terrace", "corridor", "hallway", "porch", "lawn", "courtyard", "patio", "landlord", "tenant", "rent",
    "lease", "deposit", "utility", "electricity", "plumbing", "furniture", "mattress", "duvet", "pillow",
    "curtain", "carpet", "wardrobe", "bookshelf", "pantry", "cupboard", "grocery", "receipt", "cashier",
    "barcode", "discount", "coupon", "refund", "exchange", "warranty", "retail", "bargain", "wholesale",
    "clearance", "aisle", "shelf", "trolley", "basket", "butcher", "bakery", "deli", "pharmacy", "prescription",
    "dosage", "pill", "capsule", "tablet", "ointment", "bandage", "thermometer", "symptom", "fever", "cough",
    "flu", "fatigue", "allergy", "physician", "clinic", "emergency", "paramedic", "stretcher", "patient",
    "surgeon", "operation", "recovery", "therapy", "insurance", "policy", "coverage", "claim", "premium",
    "banking", "savings", "transaction", "withdraw", "deposit", "transfer", "balance", "statement", "overdraft",
    "teller", "automated", "atm", "loan", "mortgage", "interest", "installment", "debt", "debit", "billing",
    "invoice", "fee", "charge", "tariff", "postage", "courier", "delivery", "tracking", "envelope", "stamp",
    "mailbox", "carrier", "dispatcher", "recipient", "sender", "shipment", "cargo", "declaration", "duty",
    "exempt", "signature", "acknowledgment", "confirmation", "cancellation", "reschedule", "appointment",
    "consultation", "negotiation", "agreement", "guarantee", "inquiry", "complaint", "feedback", "testimonial",
    "questionnaire", "applicant", "candidate", "resume", "vacancy", "recruiter", "reference", "background",
    "qualification", "certificate", "diploma", "bachelor", "master", "doctorate", "syllabus", "curriculum",
    "tuition", "scholarship", "fellowship", "campus", "dormitory", "cafeteria", "auditorium", "laboratory",
    "workshop", "seminar", "tutorial", "lecture", "instructor", "faculty", "dean", "scholar", "enrollment",
    "semester", "deadline", "assignment", "dissertation", "presentation", "defense", "graduation", "alumni",
    "reunion", "banquet", "buffet", "appetizer", "entree", "dessert", "beverage", "cocktail", "dressing",
    "condiment", "cutlery", "utensil", "waiter", "waitress", "menu", "bill", "tip", "takeaway", "portion",
    "cuisine", "gourmet", "delicacy", "dietary", "vegan", "vegetarian", "gluten", "seasoning", "garnish",
    "hospitality", "amenity", "complimentary", "valet", "housekeeping", "laundromat", "dry-clean", "tailor",
    "fitting", "alteration", "haircut", "salon", "barber", "shampoo", "manicure", "pedicure", "spa", "massage",
    "fitness", "gymnasium", "treadmill", "aerobic", "cardio", "hydration", "nutrition", "wellness", "relaxation"
]

# 5. PROFESSIONAL - Business & Workplace English (~350 words)
PROFESSIONAL_BUSINESS_WORDS = [
    "agenda", "stakeholder", "deliverable", "milestone", "consensus", "leverage", "benchmark", "synergy",
    "streamline", "feasibility", "contingency", "compliance", "revenue", "deficit", "margin", "turnover",
    "dividend", "asset", "liability", "equity", "portfolio", "procurement", "logistics", "inventory",
    "vendor", "negotiation", "compromise", "arbitration", "incentive", "compensation", "appraisal", "restructure",
    "merger", "acquisition", "monopoly", "subsidiary", "franchise", "consortium", "venture", "entrepreneur",
    "capital", "inflation", "recession", "fiscal", "audit", "depreciation", "amortization", "collateral",
    "liquidity", "solvency", "diversification", "allocation", "metric", "kpi", "roi", "headcount", "outsourcing",
    "offshoring", "onboarding", "attrition", "tenure", "remuneration", "perk", "bonus", "redundancy", "severance",
    "downsize", "pipeline", "bandwidth", "roadmap", "bottleneck", "pivot", "traction", "scalable", "disruptive",
    "agile", "scrum", "sprint", "backlog", "retrospective", "standup", "briefing", "debrief", "minutes",
    "quorum", "unanimous", "bipartisan", "ratify", "endorse", "veto", "breach", "clause", "indemnity",
    "jurisdiction", "statutory", "confidentiality", "proprietary", "patent", "copyright", "trademark", "royalty",
    "infringement", "litigation", "covenant", "warrant", "default", "creditor", "debtor", "liquidation",
    "bankruptcy", "hedge", "derivative", "security", "bond", "yield", "coupon", "maturity", "volatility",
    "arbitrage", "bull", "bear", "rally", "slump", "stagnation", "stagflation", "surplus", "tariff", "quota",
    "embargo", "sanction", "bilateral", "multilateral", "globalization", "localization", "supply-chain",
    "variance", "forecast", "projection", "runway", "burn-rate", "angel", "valuation", "due-diligence",
    "dilution", "vesting", "stock-option", "buyout", "ipo", "prospectus", "underwriter", "roadshow", "listing",
    "flotation", "market-cap", "blue-chip", "working-capital", "gross-profit", "operating-profit", "net-profit",
    "ebitda", "ebit", "overhead", "fixed-cost", "variable-cost", "marginal-cost", "break-even", "mission-statement",
    "competitive-landscape", "market-share", "brand-equity", "conversion-rate", "funnel", "touchpoint",
    "omnichannel", "saas", "paas", "iaas", "enterprise", "key-account", "cold-call", "lead-generation",
    "qualification", "nurturing", "closing", "upsell", "cross-sell", "renewal", "retention", "account-management",
    "client-facing", "handoff", "implementation", "sla", "escalation", "troubleshooting", "resolution",
    "post-mortem", "knowledge-base", "faq", "ticketing", "dispatch", "csat", "nps", "advocacy", "evangelist",
    "referral", "whitepaper", "webinar", "brand-awareness", "impression", "bounce-rate", "engagement", "reach",
    "viral", "organic", "affiliate", "influencer", "sponsor", "campaign", "segmentation", "targeting",
    "positioning", "differentiation", "niche", "vertical", "horizontal", "consolidation", "conglomerate",
    "holding-company", "joint-venture", "strategic-alliance", "licensing", "franchising", "remittance",
    "wire-transfer", "escrow", "clearing", "settlement", "governance", "shareholder", "fiduciary", "board",
    "executive", "officer", "transparency", "accountability", "whistleblower", "integrity", "stewardship"
]

# 6. PROFESSIONAL - Computer Science & Software Engineering (~350 words)
PROFESSIONAL_TECH_WORDS = [
    "algorithm", "architecture", "asynchronous", "synchronous", "concurrency", "parallelism", "multithreading",
    "throughput", "latency", "bandwidth", "scalability", "elasticity", "fault-tolerance", "redundancy",
    "replication", "sharding", "partitioning", "clustering", "load-balancer", "cache", "persistence",
    "serialization", "deserialization", "idempotent", "immutable", "polymorphism", "encapsulation",
    "inheritance", "abstraction", "interface", "dependency", "injection", "middleware", "gateway",
    "microservice", "monolith", "containerization", "orchestration", "deployment", "pipeline", "repository",
    "commit", "branch", "merge", "rebase", "pull-request", "refactoring", "debugging", "profiling",
    "optimization", "telemetry", "monitoring", "metrics", "logging", "tracing", "authentication",
    "authorization", "credential", "encryption", "decryption", "cryptography", "handshake", "protocol",
    "socket", "websocket", "payload", "header", "cookie", "session", "token", "endpoint", "query",
    "schema", "migration", "transaction", "isolation", "deadlock", "indexing", "normalization",
    "denormalization", "nosql", "relational", "neural", "gradient", "backpropagation", "supervised",
    "unsupervised", "reinforcement", "hyperparameter", "inference", "tensor", "embedding", "transformer",
    "attention", "tokenization", "prompt", "fine-tuning", "heuristic", "deterministic", "stochastic",
    "anomaly", "benchmark", "regression", "clustering", "classification", "overfitting", "underfitting",
    "generalization", "regularization", "epoch", "batch", "learning-rate", "activation", "convolution",
    "recurrent", "generative", "adversarial", "diffusion", "autoencoder", "latent", "vector", "semantic",
    "cosine", "similarity", "distance", "euclidean", "dimension", "reduction", "ensemble", "cross-validation",
    "precision", "recall", "accuracy", "hallucination", "ground-truth", "reranking", "context-window",
    "temperature", "quantization", "distillation", "alignment", "safety", "guardrail", "jailbreak",
    "watermark", "attribution", "agentic", "autonomous", "executor", "memory", "scratchpad", "reasoning",
    "perplexity", "compiler", "interpreter", "virtual-machine", "bytecode", "runtime", "garbage-collection",
    "memory-leak", "stack", "heap", "pointer", "buffer", "overflow", "race-condition", "mutex", "semaphore",
    "spinlock", "atomic", "thread-pool", "event-loop", "non-blocking", "polling", "interrupt", "system-call",
    "kernel", "user-space", "context-switch", "scheduling", "process", "daemon", "thread", "fiber",
    "coroutine", "promise", "future", "callback", "closure", "lambda", "pure-function", "side-effect",
    "recursion", "tail-call", "dynamic-programming", "memoization", "divide-and-conquer", "backtracking",
    "breadth-first-search", "depth-first-search", "dijkstra", "topological-sort", "binary-search", "hash-table",
    "binary-tree", "red-black-tree", "avl-tree", "b-tree", "trie", "priority-queue", "graph", "adjacency-matrix",
    "directed-acyclic-graph", "spanning-tree", "disjoint-set", "bloom-filter", "lru-cache", "inverted-index",
    "webhook", "restful", "graphql", "rpc", "grpc", "protobuf", "cors", "csrf", "xss", "sql-injection",
    "sanitize", "sandbox", "firewall", "proxy", "reverse-proxy", "ssl", "tls", "certificate", "cipher"
]


def clean_lemma(w):
    w = w.strip().lower()
    # If hyphenated, try looking up as is or with hyphen replaced
    return w


def escape_sql(val):
    if val is None:
        return "NULL"
    s = str(val).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{s}'"


def main():
    print("Step 1: Reading existing dict_entry lemmas from MySQL...")
    out = subprocess.check_output(
        ['mysql', '-uroot', '-proot', '-N', '-e', 'USE lexiflow_db; SELECT id, LOWER(lemma) FROM dict_entry;'],
        text=True, encoding='utf-8', errors='replace'
    )
    existing_dict = {}
    for line in out.strip().split('\n'):
        line = line.strip()
        if not line:
            continue
        parts = line.split('\t')
        if len(parts) >= 2:
            try:
                wid = int(parts[0])
                lemma = parts[1].strip().lower()
                existing_dict[lemma] = wid
            except ValueError:
                pass

    print(f"Loaded {len(existing_dict)} existing lemmas from dict_entry.")

    # Collect all needed words across all 6 wordbooks
    book_defs = [
        {
            "title": "影视美剧日常口语 500 词",
            "category": "COLLOQUIAL",
            "description": "精选欧美经典影视原声与地道日常会话最高频出现的 500 组核心口语与习语词汇",
            "cover_url": "/covers/daily.jpg",
            "words": COLLOQUIAL_TV_WORDS
        },
        {
            "title": "生活交际与出行实用口语",
            "category": "COLLOQUIAL",
            "description": "涵盖社交聚会、旅行出行、就餐消费与日常居家高频生活实景词汇",
            "cover_url": "/covers/daily.jpg",
            "words": COLLOQUIAL_LIFE_WORDS
        },
        {
            "title": "国际商务与职场沟通核心词",
            "category": "PROFESSIONAL",
            "description": "外企办公、商务谈判、项目管理、财务商业与战略协同核心专业词汇",
            "cover_url": "/covers/business.jpg",
            "words": PROFESSIONAL_BUSINESS_WORDS
        },
        {
            "title": "互联网与计算机技术专业词",
            "category": "PROFESSIONAL",
            "description": "涵盖现代软件工程、算法与数据结构、分布式架构、人工智能与云计算前沿技术词汇",
            "cover_url": "/covers/tech.jpg",
            "words": PROFESSIONAL_TECH_WORDS
        },
        {
            "title": "AWL 国际学术通用核心词汇 (Academic Word List)",
            "category": "ACADEMIC",
            "description": "Averil Coxhead 基于 350 万词学术语料库提炼的 570 组国际学术通用权威核心词族，科研与论文阅读必备黄金词表",
            "cover_url": "/covers/academic.jpg",
            "words": AWL_WORDS
        },
        {
            "title": "国际顶刊论文写作与学术研读高频词",
            "category": "ACADEMIC",
            "description": "精选 Nature、Science 等顶刊论文假说验证、实证分析、逻辑推演与论文撰写高频动词及术语",
            "cover_url": "/covers/academic.jpg",
            "words": ACADEMIC_RESEARCH_WORDS
        }
    ]

    all_needed_lemmas = set()
    cleaned_book_words = []
    for b in book_defs:
        deduped = []
        seen = set()
        for w in b["words"]:
            lw = clean_lemma(w)
            if lw and lw not in seen:
                seen.add(lw)
                deduped.append(lw)
                all_needed_lemmas.add(lw)
        cleaned_book_words.append(deduped)

    print(f"Total unique words across all 6 wordbooks: {len(all_needed_lemmas)}")

    missing_lemmas = [w for w in all_needed_lemmas if w not in existing_dict]
    print(f"Missing words to load from ECDICT: {len(missing_lemmas)}")

    ecdict_data = {}
    if missing_lemmas:
        print("Step 2: Scanning material/ecdict.csv for missing words...")
        missing_set = set(missing_lemmas)
        with open('material/ecdict.csv', 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rw = row['word'].lower().strip()
                if rw in missing_set:
                    ecdict_data[rw] = row

        print(f"Matched {len(ecdict_data)} words in ECDICT. Missing in ECDICT: {len(missing_set - set(ecdict_data.keys()))}")

    # Generate SQL
    print("Step 3: Generating SQL statements...")
    sql_lines = ["USE lexiflow_db;\nSET NAMES utf8mb4;\n"]

    # Insert missing dict_entry items
    inserted_lemmas = {}
    for lemma in missing_lemmas:
        row = ecdict_data.get(lemma)
        if row:
            raw_phonetic = row.get('phonetic', '').strip()
            formatted_phonetic = f"/{raw_phonetic}/" if raw_phonetic else f"/{lemma}/"
            pos = row.get('pos', '').strip() or 'n./v.'
            translation = row.get('translation', '').strip().replace('\\n', '\n')
            definition_cn = translation.replace('\n', '； ') if translation else f"（{lemma}）"
            definition_en = row.get('definition', '').strip().replace('\\n', '; ')
            tag = row.get('tag', '').strip()
            frq = 9999
            try:
                if row.get('frq'):
                    frq = int(row['frq'])
            except ValueError:
                pass
        else:
            # Fallback
            formatted_phonetic = f"/{lemma}/"
            pos = 'n./v.'
            definition_cn = f"（{lemma}）"
            definition_en = ""
            tag = ""
            frq = 9999

        sample_sentence = f"The term '{lemma}' is frequently used in context."
        sample_translation = f"术语 '{lemma}' 在该语境中经常被使用。"

        audio_us = f"https://dict.youdao.com/dictvoice?audio={lemma}&type=2"
        audio_uk = f"https://dict.youdao.com/dictvoice?audio={lemma}&type=1"

        sql_lines.append(
            f"INSERT INTO `dict_entry` (`lemma`, `phonetic_us`, `phonetic_uk`, `audio_us`, `audio_uk`, `pos`, "
            f"`definition_cn`, `definition_en`, `tags`, `frequency_rank`, `sample_sentence`, `sample_translation`, `created_at`) "
            f"VALUES ({escape_sql(lemma)}, {escape_sql(formatted_phonetic)}, {escape_sql(formatted_phonetic)}, "
            f"{escape_sql(audio_us)}, {escape_sql(audio_uk)}, {escape_sql(pos)}, {escape_sql(definition_cn)}, "
            f"{escape_sql(definition_en)}, {escape_sql(tag)}, {frq}, {escape_sql(sample_sentence)}, "
            f"{escape_sql(sample_translation)}, NOW()) "
            f"ON DUPLICATE KEY UPDATE `definition_cn` = VALUES(`definition_cn`);\n"
        )

    # Write intermediate SQL to insert dict entries first
    temp_dict_sql = "scratch_insert_dict.sql"
    with open(temp_dict_sql, "w", encoding="utf-8") as f:
        f.writelines(sql_lines)

    print(f"Executing dict_entry inserts into MySQL ({len(sql_lines)} statements)...")
    subprocess.check_call(['mysql', '-uroot', '-proot', '--default-character-set=utf8mb4'], stdin=open(temp_dict_sql, 'rb'))
    os.remove(temp_dict_sql)

    # Re-fetch word IDs from MySQL
    print("Re-fetching all lemma IDs from MySQL...")
    out = subprocess.check_output(
        ['mysql', '-uroot', '-proot', '-N', '-e', 'USE lexiflow_db; SELECT id, LOWER(lemma) FROM dict_entry;'],
        text=True, encoding='utf-8', errors='replace'
    )
    for line in out.strip().split('\n'):
        line = line.strip()
        if not line:
            continue
        parts = line.split('\t')
        if len(parts) >= 2:
            try:
                wid = int(parts[0])
                lemma = parts[1].strip().lower()
                existing_dict[lemma] = wid
            except ValueError:
                pass

    print(f"Total lemmas now available in dict_entry: {len(existing_dict)}")

    # Now insert wordbooks and wordbook items
    wordbook_sql_lines = ["USE lexiflow_db;\nSET NAMES utf8mb4;\n"]

    for idx, b in enumerate(book_defs):
        words = cleaned_book_words[idx]
        valid_word_ids = [existing_dict[w] for w in words if w in existing_dict]
        total_words = len(valid_word_ids)

        # Check if wordbook title already exists
        check_out = subprocess.check_output(
            ['mysql', '-uroot', '-proot', '-N', '-e', f"USE lexiflow_db; SELECT id FROM wordbook WHERE title = '{b['title']}';"],
            text=True, encoding='utf-8', errors='replace'
        ).strip()

        if check_out:
            book_id = int(check_out)
            print(f"Wordbook '{b['title']}' already exists with id {book_id}. Updating total_words...")
            wordbook_sql_lines.append(
                f"UPDATE `wordbook` SET `total_words` = {total_words}, `category` = '{b['category']}', `description` = {escape_sql(b['description'])}, `cover_url` = '{b['cover_url']}' WHERE `id` = {book_id};\n"
            )
            # Remove old items
            wordbook_sql_lines.append(f"DELETE FROM `wordbook_item` WHERE `wordbook_id` = {book_id};\n")
        else:
            wordbook_sql_lines.append(
                f"INSERT INTO `wordbook` (`title`, `description`, `category`, `cover_url`, `total_words`, `status`, `created_at`) "
                f"VALUES ({escape_sql(b['title'])}, {escape_sql(b['description'])}, '{b['category']}', '{b['cover_url']}', {total_words}, 1, NOW());\n"
            )
            wordbook_sql_lines.append("SET @wb_id = LAST_INSERT_ID();\n")

        # Insert items
        chapter_size = 25
        wb_id_var = str(book_id) if check_out else "@wb_id"

        values_chunks = []
        for i, wid in enumerate(valid_word_ids):
            ch = (i // chapter_size) + 1
            ord_idx = (i % chapter_size) + 1
            values_chunks.append(f"({wb_id_var}, {wid}, {ch}, {ord_idx}, NOW())")

        # Insert in chunks of 500
        for c in range(0, len(values_chunks), 500):
            chunk = values_chunks[c:c+500]
            wordbook_sql_lines.append(
                f"INSERT INTO `wordbook_item` (`wordbook_id`, `word_id`, `chapter_index`, `order_index`, `created_at`) VALUES \n" +
                ",\n".join(chunk) + ";\n"
            )

    temp_wb_sql = "scratch_insert_wordbooks.sql"
    with open(temp_wb_sql, "w", encoding="utf-8") as f:
        f.writelines(wordbook_sql_lines)

    print(f"Executing wordbook inserts into MySQL...")
    subprocess.check_call(['mysql', '-uroot', '-proot', '--default-character-set=utf8mb4'], stdin=open(temp_wb_sql, 'rb'))
    os.remove(temp_wb_sql)

    print("Success! Wordbooks seeded into MySQL successfully.")


if __name__ == '__main__':
    main()
