from py_vapid import Vapid

def generate_keys():
    vapid = Vapid()
    vapid.generate_keys()
    
    private_key = vapid.private_key_to_base64()
    public_key = vapid.public_key_to_base64()
    
    print("Add these to your .env:")
    print("--- Backend ---")
    print(f"VAPID_PRIVATE_KEY={private_key}")
    print("VAPID_SUBSCRIBER=mailto:admin@example.com")
    print("\n--- Frontend (.env.local) ---")
    print(f"NEXT_PUBLIC_VAPID_PUBLIC_KEY={public_key}")

if __name__ == "__main__":
    generate_keys()
