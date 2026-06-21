import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from messfit_api.config import settings

async def main():
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        print('Creating storage bucket...')
        
        commands = [
            "INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;",
            "DROP POLICY IF EXISTS \"Avatar images are publicly accessible.\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Users can upload their own avatar.\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Users can update their own avatar.\" ON storage.objects;",
            "DROP POLICY IF EXISTS \"Users can delete their own avatar.\" ON storage.objects;",
            "CREATE POLICY \"Avatar images are publicly accessible.\" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');",
            "CREATE POLICY \"Users can upload their own avatar.\" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);",
            "CREATE POLICY \"Users can update their own avatar.\" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);",
            "CREATE POLICY \"Users can delete their own avatar.\" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() = owner);"
        ]
        
        for cmd in commands:
            await conn.execute(text(cmd))
            
        print('Bucket and policies created successfully.')

asyncio.run(main())
