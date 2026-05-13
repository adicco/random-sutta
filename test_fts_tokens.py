import sqlite3

db = sqlite3.connect(":memory:")
cursor = db.cursor()

cursor.execute("""
    CREATE VIRTUAL TABLE test_fts USING fts5(
        uid,
        tokenize='unicode61 remove_diacritics 2'
    )
""")

cursor.execute("INSERT INTO test_fts(uid) VALUES ('mn1')")
cursor.execute("INSERT INTO test_fts(uid) VALUES ('an1.1')")

def search(query):
    print(f"Searching for: '{query}'")
    try:
        cursor.execute("SELECT uid FROM test_fts WHERE test_fts MATCH ?", (query,))
        results = cursor.fetchall()
        for row in results:
            print(f"  Match: {row[0]}")
        if not results:
            print("  No matches found.")
    except Exception as e:
        print(f"  Error: {e}")

# Test 1: mn 1 -> mn* AND 1*
search('mn* AND 1*')

# Test 2: mn1*
search('mn1*')

# Test 3: an1 1 -> an1* AND 1*
search('an1* AND 1*')

# Test 4: an1.1
search('an1.1') # This usually fails in FTS match if not escaped

db.close()
