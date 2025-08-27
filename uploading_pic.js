import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Example: Upload a local image file
const fileBuffer = fs.readFileSync('profile.png')

const { data, error } = await supabase.storage
  .from('profile-pics')   // bucket name
  .upload('avatars/profile.png', fileBuffer, {
    contentType: 'image/png'
  })

if (error) console.error(error)
else console.log("Uploaded:", data)