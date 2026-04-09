def normalize_salesforce_domain(domain: str | None) -> str:
    """
    Return hostname only for API calls (e.g. myorg.my.salesforce.com).
    Accepts bare host or full URL; strips scheme, path, query, and fragments.
    """
    if domain is None:
        return ""
    d = str(domain).strip()
    if not d:
        return ""
    low = d.lower()
    if low.startswith("https://"):
        d = d[8:]
    elif low.startswith("http://"):
        d = d[7:]
    d = d.split("/")[0].split("?")[0].split("#")[0].strip()
    if "@" in d:
        d = d.rsplit("@", 1)[-1].strip()
    return d.rstrip(".").strip()
