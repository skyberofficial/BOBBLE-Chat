# **App Name**: BubbleLink Connect

## Core Features:

- User Authentication: Allow users to create accounts and log in securely using Supabase email authentication and a unique 10-digit user ID.
- User ID Generation: Generate a unique 10-digit user ID upon account creation using Supabase.
- User Search: Implement a search bar to find other users by their unique User ID, querying the Supabase database.
- User Listing: List found users with chat buttons when a valid user ID is entered in the search bar.
- Real-time Chat: Enable one-on-one real-time chat between users using dual layers of WebSocket and Socket.IO for message delivery. Chat data is stored in Supabase.
- Chat Panel and Chat Area: When the user is logged in, they'll see a chat panel and area to converse in.

## Style Guidelines:

- Primary color: Soft sky blue (#87CEEB) to evoke a sense of connection and communication.
- Background color: Light grayish-blue (#F0F8FF) to create a clean and calming atmosphere.
- Accent color: Warm coral (#FF7F50) to highlight interactive elements and call-to-actions.
- Body and headline font: 'Inter', a grotesque-style sans-serif, to give a modern, machined, objective, and neutral look.
- Use simple, outlined icons for navigation and chat actions, ensuring clarity and ease of use.
- Design a clean and intuitive layout with a clear separation between the search bar, user listing, and chat panel.
- Incorporate subtle animations for message delivery and user presence to enhance the feeling of real-time interaction.