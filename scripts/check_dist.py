"""Check the built wheel and sdist in dist/ before they're published.

    uv run python scripts/check_dist.py [expected-version]

Fails if the interface or the migrations are missing, if JavaScript sources or data files
leaked into the sdist, or if the version isn't the expected one.
"""
import glob
import sys
import tarfile
import zipfile

NEEDED_IN_WHEEL = [
    "dividendcase/web/index.html",
    "dividendcase/web/dashboard/index.html",
    "dividendcase/migrations/env.py",
    "dividendcase/migrations/script.py.mako",
    "dividendcase/migrations/versions/0001_baseline.py",
]
NEVER_IN_SDIST = ["/frontend/", "/site/", "/packages/", "node_modules", ".test-data", ".db", ".env"]


def main() -> int:
    wheels, sdists = glob.glob("dist/*.whl"), glob.glob("dist/*.tar.gz")
    if len(wheels) != 1 or len(sdists) != 1:
        print(f"Expected one wheel and one sdist in dist/, found {wheels + sdists}")
        return 1
    problems = []

    names = set(zipfile.ZipFile(wheels[0]).namelist())
    problems += [f"missing from the wheel: {n}" for n in NEEDED_IN_WHEEL if n not in names]
    web_files = sum(n.startswith("dividendcase/web/") for n in names)
    if web_files < 50:
        problems.append(f"the wheel has only {web_files} interface files")

    with tarfile.open(sdists[0]) as sdist:
        leaked = [n for n in sdist.getnames() if any(bad in n for bad in NEVER_IN_SDIST)]
    problems += [f"shouldn't be in the sdist: {n}" for n in leaked[:10]]

    if len(sys.argv) > 1:
        expected = sys.argv[1].removeprefix("v")
        if f"dividendcase-{expected}-" not in wheels[0]:
            problems.append(f"{wheels[0]} isn't version {expected}")

    for p in problems:
        print("FAIL", p)
    if not problems:
        print(f"ok   {wheels[0]}: {len(names)} files, {web_files} of them the interface")
        print(f"ok   {sdists[0]}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
