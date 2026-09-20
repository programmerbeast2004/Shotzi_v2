"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Smile,
  Heart,
  Cat,
  Coffee,
  Activity,
  Car,
  Lightbulb,
  Search,
  X,
  History,
  Sparkles,
} from "lucide-react";

export const WHATSAPP_EMOJI_CATEGORIES = [
  {
    id: "recent",
    name: "Recent",
    icon: History,
    emojis: [],
  },
  {
    id: "smileys",
    name: "Smileys & Faces",
    icon: Smile,
    emojis: [
      { char: "😀", name: "grinning face", tags: ["happy", "smile", "grin"] },
      { char: "😃", name: "grinning face with big eyes", tags: ["happy", "smile", "joy"] },
      { char: "😄", name: "grinning face with smiling eyes", tags: ["happy", "laugh"] },
      { char: "😁", name: "beaming face with smiling eyes", tags: ["grin", "teeth"] },
      { char: "😆", name: "grinning squinting face", tags: ["laugh", "haha"] },
      { char: "😅", name: "grinning face with sweat", tags: ["nervous", "relief"] },
      { char: "🤣", name: "rolling on the floor laughing", tags: ["rofl", "lol", "laugh"] },
      { char: "😂", name: "face with tears of joy", tags: ["cry", "laugh", "joy", "lol"] },
      { char: "🙂", name: "slightly smiling face", tags: ["smile", "calm"] },
      { char: "🙃", name: "upside-down face", tags: ["silly", "sarcastic"] },
      { char: "😉", name: "winking face", tags: ["wink", "flirt"] },
      { char: "😊", name: "smiling face with smiling eyes", tags: ["blush", "warm"] },
      { char: "😇", name: "smiling face with halo", tags: ["angel", "innocent"] },
      { char: "🥰", name: "smiling face with hearts", tags: ["love", "crush", "adore"] },
      { char: "😍", name: "smiling face with heart-eyes", tags: ["love", "heart", "eyes"] },
      { char: "🤩", name: "star-struck", tags: ["stars", "amazed", "wow"] },
      { char: "😘", name: "face blowing a kiss", tags: ["kiss", "love"] },
      { char: "😗", name: "kissing face", tags: ["kiss", "whistle"] },
      { char: "😚", name: "kissing face with closed eyes", tags: ["kiss", "blush"] },
      { char: "😋", name: "face savoring food", tags: ["yum", "tasty", "delicious"] },
      { char: "😛", name: "face with tongue", tags: ["silly", "tongue"] },
      { char: "😜", name: "winking face with tongue", tags: ["joke", "crazy"] },
      { char: "🤪", name: "zany face", tags: ["wild", "crazy"] },
      { char: "😝", name: "squinting face with tongue", tags: ["playful", "haha"] },
      { char: "🤑", name: "money-mouth face", tags: ["money", "rich"] },
      { char: "🤗", name: "smiling face with open hands", tags: ["hug", "warm"] },
      { char: "🤭", name: "face with hand over mouth", tags: ["oops", "giggle"] },
      { char: "🤫", name: "shushing face", tags: ["quiet", "secret", "shh"] },
      { char: "🤔", name: "thinking face", tags: ["think", "hmm", "ponder"] },
      { char: "🤐", name: "zipper-mouth face", tags: ["silent", "zip"] },
      { char: "🤨", name: "face with raised eyebrow", tags: ["suspicious", "doubt"] },
      { char: "😐", name: "neutral face", tags: ["meh", "poker"] },
      { char: "😑", name: "expressionless face", tags: ["unimpressed", "bored"] },
      { char: "😶", name: "face without mouth", tags: ["speechless"] },
      { char: "😏", name: "smirking face", tags: ["smirk", "flirt"] },
      { char: "😒", name: "unamused face", tags: ["side-eye", "bored"] },
      { char: "🙄", name: "face with rolling eyes", tags: ["eyeroll", "whatever"] },
      { char: "😬", name: "grimacing face", tags: ["awkward", "yikes"] },
      { char: "😮‍💨", name: "face exhaling", tags: ["sigh", "relief", "tired"] },
      { char: "🤥", name: "lying face", tags: ["pinocchio", "lie"] },
      { char: "😌", name: "relieved face", tags: ["peace", "calm"] },
      { char: "😔", name: "pensive face", tags: ["sad", "depressed"] },
      { char: "😪", name: "sleepy face", tags: ["tired", "sleep"] },
      { char: "🤤", name: "drooling face", tags: ["hungry", "craving"] },
      { char: "😴", name: "sleeping face", tags: ["zzz", "sleep"] },
      { char: "😷", name: "face with medical mask", tags: ["sick", "mask"] },
      { char: "🤒", name: "face with thermometer", tags: ["sick", "fever"] },
      { char: "🤕", name: "face with head-bandage", tags: ["hurt", "injured"] },
      { char: "🤢", name: "nauseated face", tags: ["gross", "puke"] },
      { char: "🤮", name: "face vomiting", tags: ["vomit", "barf"] },
      { char: "🤧", name: "sneezing face", tags: ["sneeze", "cold"] },
      { char: "🥵", name: "hot face", tags: ["heat", "sweat", "summer"] },
      { char: "🥶", name: "cold face", tags: ["freezing", "ice", "winter"] },
      { char: "🥴", name: "woozy face", tags: ["drunk", "dizzy"] },
      { char: "😵", name: "knocked-out face", tags: ["dead", "dazed"] },
      { char: "🤯", name: "exploding head", tags: ["mindblown", "shock"] },
      { char: "🤠", name: "cowboy hat face", tags: ["cowboy", "yeehaw"] },
      { char: "🥳", name: "partying face", tags: ["celebrate", "party", "birthday"] },
      { char: "😎", name: "smiling face with sunglasses", tags: ["cool", "glasses"] },
      { char: "🤓", name: "nerd face", tags: ["nerd", "geek"] },
      { char: "🧐", name: "face with monocle", tags: ["classy", "curious"] },
      { char: "😕", name: "confused face", tags: ["confused", "what"] },
      { char: "😟", name: "worried face", tags: ["worry", "nervous"] },
      { char: "🙁", name: "slightly frowning face", tags: ["sad", "frown"] },
      { char: "😮", name: "face with open mouth", tags: ["surprised", "gasp"] },
      { char: "😯", name: "hushed face", tags: ["surprise", "shock"] },
      { char: "😲", name: "astonished face", tags: ["omg", "amazed"] },
      { char: "😳", name: "flushed face", tags: ["blush", "embarrassed"] },
      { char: "🥺", name: "pleading face", tags: ["puppy eyes", "please", "cute"] },
      { char: "😦", name: "frowning face with open mouth", tags: ["shock", "aw"] },
      { char: "😨", name: "fearful face", tags: ["scared", "fear"] },
      { char: "😰", name: "anxious face with sweat", tags: ["panic", "sweat"] },
      { char: "😥", name: "sad but relieved face", tags: ["whew", "almost"] },
      { char: "😢", name: "crying face", tags: ["tear", "sad", "cry"] },
      { char: "😭", name: "loudly crying face", tags: ["sobbing", "bawling", "cry"] },
      { char: "😱", name: "face screaming in fear", tags: ["scream", "horror", "munch"] },
      { char: "😖", name: "confounded face", tags: ["frustrated", "upset"] },
      { char: "😣", name: "persevering face", tags: ["struggling", "endure"] },
      { char: "😞", name: "disappointed face", tags: ["sad", "down"] },
      { char: "😓", name: "downcast face with sweat", tags: ["hard work", "tired"] },
      { char: "😩", name: "weary face", tags: ["tired", "exhausted"] },
      { char: "😫", name: "tired face", tags: ["whine", "fatigue"] },
      { char: "🥱", name: "yawning face", tags: ["sleepy", "bored"] },
      { char: "😤", name: "face with steam from nose", tags: ["triumph", "angry", "huff"] },
      { char: "😡", name: "pouting face", tags: ["angry", "rage", "mad"] },
      { char: "😠", name: "angry face", tags: ["mad", "grumpy"] },
      { char: "🤬", name: "face with symbols on mouth", tags: ["swearing", "curse"] },
      { char: "😈", name: "smiling face with horns", tags: ["devil", "evil"] },
      { char: "👿", name: "angry face with horns", tags: ["devil", "demon"] },
      { char: "💀", name: "skull", tags: ["dead", "skeleton", "dying"] },
      { char: "☠️", name: "skull and crossbones", tags: ["danger", "pirate"] },
      { char: "💩", name: "pile of poo", tags: ["poop", "turd"] },
      { char: "🤡", name: "clown face", tags: ["clown", "circus"] },
      { char: "👻", name: "ghost", tags: ["spooky", "boo", "halloween"] },
      { char: "👽", name: "alien", tags: ["ufo", "space"] },
      { char: "🤖", name: "robot", tags: ["bot", "android"] },
    ],
  },
  {
    id: "gestures",
    name: "Hands & Hearts",
    icon: Heart,
    emojis: [
      { char: "👋", name: "waving hand", tags: ["hello", "bye", "wave"] },
      { char: "🤚", name: "raised back of hand", tags: ["hand", "backhand"] },
      { char: "🖐️", name: "hand with fingers splayed", tags: ["hand", "five"] },
      { char: "✋", name: "raised hand", tags: ["stop", "high five"] },
      { char: "🖖", name: "vulcan salute", tags: ["spock", "star trek"] },
      { char: "👌", name: "OK hand", tags: ["ok", "perfect", "good"] },
      { char: "🤌", name: "pinched fingers", tags: ["italian", "chef kiss"] },
      { char: "🤏", name: "pinching hand", tags: ["tiny", "little bit"] },
      { char: "✌️", name: "victory hand", tags: ["peace", "v"] },
      { char: "🤞", name: "crossed fingers", tags: ["luck", "hope"] },
      { char: "🫰", name: "hand with index finger and thumb crossed", tags: ["kpop", "heart", "money"] },
      { char: "🤟", name: "love-you gesture", tags: ["ily", "love"] },
      { char: "🤘", name: "sign of the horns", tags: ["rock", "metal"] },
      { char: "🤙", name: "call me hand", tags: ["shaka", "hang loose", "phone"] },
      { char: "👈", name: "backhand index pointing left", tags: ["left", "point"] },
      { char: "👉", name: "backhand index pointing right", tags: ["right", "point"] },
      { char: "👆", name: "backhand index pointing up", tags: ["up", "point"] },
      { char: "👇", name: "backhand index pointing down", tags: ["down", "below"] },
      { char: "☝️", name: "index pointing up", tags: ["one", "listen"] },
      { char: "👍", name: "thumbs up", tags: ["yes", "like", "agree", "good"] },
      { char: "👎", name: "thumbs down", tags: ["no", "dislike", "bad"] },
      { char: "✊", name: "raised fist", tags: ["power", "fist"] },
      { char: "👊", name: "oncoming fist", tags: ["punch", "fist bump"] },
      { char: "🤛", name: "left-facing fist", tags: ["bump"] },
      { char: "🤜", name: "right-facing fist", tags: ["bump"] },
      { char: "👏", name: "clapping hands", tags: ["applause", "bravo", "clap"] },
      { char: "🙌", name: "raising hands", tags: ["celebrate", "praise", "hooray"] },
      { char: "🫶", name: "heart hands", tags: ["love", "heart", "cute"] },
      { char: "👐", name: "open hands", tags: ["hug", "open"] },
      { char: "🤲", name: "palms up together", tags: ["prayer", "receive"] },
      { char: "🤝", name: "handshake", tags: ["deal", "agreement", "friend"] },
      { char: "🙏", name: "folded hands", tags: ["please", "thank you", "pray", "namaste"] },
      { char: "✍️", name: "writing hand", tags: ["write", "pen"] },
      { char: "💅", name: "nail polish", tags: ["fabulous", "slay", "nails"] },
      { char: "🤳", name: "selfie", tags: ["camera", "phone"] },
      { char: "💪", name: "flexed biceps", tags: ["strong", "workout", "muscle"] },
      { char: "👀", name: "eyes", tags: ["looking", "look", "see"] },
      { char: "👁️", name: "eye", tags: ["sight", "view"] },
      { char: "🧠", name: "brain", tags: ["smart", "mind", "intellect"] },
      { char: "❤️", name: "red heart", tags: ["love", "like", "favorite"] },
      { char: "🧡", name: "orange heart", tags: ["orange", "warm"] },
      { char: "💛", name: "yellow heart", tags: ["yellow", "shotzi", "friendship"] },
      { char: "💚", name: "green heart", tags: ["green", "nature"] },
      { char: "💙", name: "blue heart", tags: ["blue", "trust"] },
      { char: "💜", name: "purple heart", tags: ["purple", "bts"] },
      { char: "🖤", name: "black heart", tags: ["black", "dark"] },
      { char: "🤍", name: "white heart", tags: ["pure", "peace"] },
      { char: "🤎", name: "brown heart", tags: ["brown"] },
      { char: "💔", name: "broken heart", tags: ["breakup", "sad"] },
      { char: "❤️‍🔥", name: "heart on fire", tags: ["passion", "flame"] },
      { char: "❤️‍🩹", name: "mending heart", tags: ["healing", "recovery"] },
      { char: "💕", name: "two hearts", tags: ["love", "sweet"] },
      { char: "💞", name: "revolving hearts", tags: ["love", "orbit"] },
      { char: "💓", name: "beating heart", tags: ["pulse", "heartbeat"] },
      { char: "💗", name: "growing heart", tags: ["sparkle", "love"] },
      { char: "💖", name: "sparkling heart", tags: ["shine", "magical"] },
      { char: "💘", name: "heart with arrow", tags: ["cupid", "in love"] },
      { char: "💝", name: "heart with ribbon", tags: ["gift", "present"] },
      { char: "🔥", name: "fire", tags: ["lit", "hot", "cool", "flame"] },
      { char: "✨", name: "sparkles", tags: ["magic", "stars", "shine", "clean"] },
      { char: "🌟", name: "glowing star", tags: ["bright", "star"] },
      { char: "💫", name: "dizzy", tags: ["star", "shooting"] },
      { char: "💥", name: "collision", tags: ["boom", "bang"] },
      { char: "💯", name: "hundred points", tags: ["100", "perfect", "score"] },
    ],
  },
  {
    id: "nature",
    name: "Animals & Nature",
    icon: Cat,
    emojis: [
      { char: "🐶", name: "dog face", tags: ["dog", "puppy", "pet"] },
      { char: "🐱", name: "cat face", tags: ["cat", "kitty", "kitten"] },
      { char: "🐭", name: "mouse face", tags: ["mouse", "rat"] },
      { char: "🐹", name: "hamster", tags: ["pet", "cute"] },
      { char: "🐰", name: "rabbit face", tags: ["bunny", "cute"] },
      { char: "🦊", name: "fox", tags: ["animal", "clever"] },
      { char: "🐻", name: "bear", tags: ["grizzly", "teddy"] },
      { char: "🐼", name: "panda", tags: ["bamboo", "cute"] },
      { char: "🐨", name: "koala", tags: ["australia"] },
      { char: "🐯", name: "tiger face", tags: ["wild", "cat"] },
      { char: "🦁", name: "lion", tags: ["king", "safari"] },
      { char: "🐮", name: "cow face", tags: ["milk", "farm"] },
      { char: "🐷", name: "pig face", tags: ["oink"] },
      { char: "🐸", name: "frog", tags: ["toad", "ribbit"] },
      { char: "🐵", name: "monkey face", tags: ["chimp", "jungle"] },
      { char: "🙈", name: "see-no-evil monkey", tags: ["shy", "hide"] },
      { char: "🙉", name: "hear-no-evil monkey", tags: ["deaf"] },
      { char: "🙊", name: "speak-no-evil monkey", tags: ["quiet", "secret"] },
      { char: "🐧", name: "penguin", tags: ["ice", "bird"] },
      { char: "🐦", name: "bird", tags: ["tweet", "fly"] },
      { char: "🐤", name: "baby chick", tags: ["cute", "yellow"] },
      { char: "🦆", name: "duck", tags: ["quack"] },
      { char: "🦅", name: "eagle", tags: ["bird", "freedom"] },
      { char: "🦉", name: "owl", tags: ["night", "wise"] },
      { char: "🦇", name: "bat", tags: ["vampire", "night"] },
      { char: "🐺", name: "wolf", tags: ["howl", "moon"] },
      { char: "🐗", name: "boar", tags: ["wild"] },
      { char: "🐴", name: "horse face", tags: ["pony", "ride"] },
      { char: "🦄", name: "unicorn", tags: ["magic", "fantasy"] },
      { char: "🐝", name: "honeybee", tags: ["bee", "honey"] },
      { char: "🐛", name: "bug", tags: ["insect", "caterpillar"] },
      { char: "🦋", name: "butterfly", tags: ["pretty", "wings"] },
      { char: "🐌", name: "snail", tags: ["slow"] },
      { char: "🐞", name: "lady beetle", tags: ["ladybug", "luck"] },
      { char: "🐢", name: "turtle", tags: ["slow", "reptile"] },
      { char: "🐍", name: "snake", tags: ["reptile", "slither"] },
      { char: "🐙", name: "octopus", tags: ["ocean", "tentacles"] },
      { char: "🦑", name: "squid", tags: ["sea", "calamari"] },
      { char: "🦐", name: "shrimp", tags: ["seafood"] },
      { char: "🦞", name: "lobster", tags: ["seafood"] },
      { char: "🦀", name: "crab", tags: ["beach", "cancer"] },
      { char: "🐡", name: "blowfish", tags: ["fish", "poison"] },
      { char: "🐠", name: "tropical fish", tags: ["nemo", "aquarium"] },
      { char: "🐟", name: "fish", tags: ["sea", "swim"] },
      { char: "🐬", name: "dolphin", tags: ["ocean", "smart"] },
      { char: "🐳", name: "spouting whale", tags: ["whale", "ocean"] },
      { char: "🦈", name: "shark", tags: ["jaws", "danger"] },
      { char: "🐊", name: "crocodile", tags: ["alligator", "swamp"] },
      { char: "🐆", name: "leopard", tags: ["cheetah", "fast"] },
      { char: "🦓", name: "zebra", tags: ["stripes"] },
      { char: "🦍", name: "gorilla", tags: ["ape"] },
      { char: "🐘", name: "elephant", tags: ["trunk", "big"] },
      { char: "🦛", name: "hippopotamus", tags: ["hippo"] },
      { char: "🦏", name: "rhinoceros", tags: ["rhino"] },
      { char: "🐪", name: "camel", tags: ["desert"] },
      { char: "🦒", name: "giraffe", tags: ["tall", "neck"] },
      { char: "🦘", name: "kangaroo", tags: ["australia", "hop"] },
      { char: "💐", name: "bouquet", tags: ["flowers", "gift"] },
      { char: "🌸", name: "cherry blossom", tags: ["flower", "spring", "pink"] },
      { char: "💮", name: "white flower", tags: ["stamp", "flower"] },
      { char: "🌹", name: "rose", tags: ["flower", "romance", "red"] },
      { char: "🌺", name: "hibiscus", tags: ["flower", "tropical"] },
      { char: "🌻", name: "sunflower", tags: ["flower", "yellow", "summer"] },
      { char: "🌼", name: "blossom", tags: ["flower", "daisy"] },
      { char: "🌷", name: "tulip", tags: ["flower", "spring"] },
      { char: "🌱", name: "seedling", tags: ["plant", "growth", "sprout"] },
      { char: "🌲", name: "evergreen tree", tags: ["pine", "nature", "forest"] },
      { char: "🌳", name: "deciduous tree", tags: ["tree", "nature"] },
      { char: "🌴", name: "palm tree", tags: ["beach", "tropical", "vacation"] },
      { char: "🌵", name: "cactus", tags: ["desert", "plant"] },
      { char: "🌾", name: "sheaf of rice", tags: ["crop", "grain"] },
      { char: "🌿", name: "herb", tags: ["leaf", "green", "herbal"] },
      { char: "☘️", name: "shamrock", tags: ["clover", "irish", "st patrick"] },
      { char: "🍀", name: "four leaf clover", tags: ["luck", "lucky"] },
      { char: "🍁", name: "maple leaf", tags: ["autumn", "fall", "canada"] },
      { char: "🍂", name: "fallen leaf", tags: ["autumn", "leaves"] },
      { char: "🍃", name: "leaf fluttering in wind", tags: ["breeze", "wind"] },
      { char: "🍄", name: "mushroom", tags: ["fungus", "toadstool"] },
      { char: "☀️", name: "sun", tags: ["sunny", "day", "warm"] },
      { char: "🌤️", name: "sun behind small cloud", tags: ["weather"] },
      { char: "⛅", name: "sun behind cloud", tags: ["cloudy"] },
      { char: "☁️", name: "cloud", tags: ["weather", "sky"] },
      { char: "🌧️", name: "cloud with rain", tags: ["rain", "storm"] },
      { char: "⛈️", name: "cloud with lightning and rain", tags: ["thunder", "storm"] },
      { char: "🌩️", name: "cloud with lightning", tags: ["lightning"] },
      { char: "❄️", name: "snowflake", tags: ["snow", "cold", "winter"] },
      { char: "☃️", name: "snowman", tags: ["winter", "frosty"] },
      { char: "🌈", name: "rainbow", tags: ["colorful", "pride"] },
      { char: "🌊", name: "water wave", tags: ["ocean", "sea", "surf"] },
      { char: "⚡", name: "high voltage", tags: ["lightning", "shock", "power"] },
      { char: "🌙", name: "crescent moon", tags: ["night", "sleep", "sky"] },
      { char: "⭐", name: "star", tags: ["night", "favorite"] },
    ],
  },
  {
    id: "food",
    name: "Food & Drink",
    icon: Coffee,
    emojis: [
      { char: "☕", name: "hot beverage", tags: ["coffee", "tea", "morning"] },
      { char: "🧋", name: "bubble tea", tags: ["boba", "tea", "milk tea"] },
      { char: "🍵", name: "teacup without handle", tags: ["matcha", "green tea"] },
      { char: "🍕", name: "pizza", tags: ["food", "cheese", "italian"] },
      { char: "🍔", name: "hamburger", tags: ["burger", "fast food"] },
      { char: "🍟", name: "french fries", tags: ["fries", "snack"] },
      { char: "🌭", name: "hot dog", tags: ["sausage"] },
      { char: "🥪", name: "sandwich", tags: ["bread", "lunch"] },
      { char: "🌮", name: "taco", tags: ["mexican"] },
      { char: "🌯", name: "burrito", tags: ["mexican", "wrap"] },
      { char: "🥗", name: "green salad", tags: ["healthy", "vegan"] },
      { char: "🍝", name: "spaghetti", tags: ["pasta", "italian"] },
      { char: "🍜", name: "steaming bowl", tags: ["ramen", "noodles", "soup"] },
      { char: "🍲", name: "pot of food", tags: ["stew", "curry"] },
      { char: "🍛", name: "curry rice", tags: ["indian", "curry", "spicy"] },
      { char: "🍣", name: "sushi", tags: ["japanese", "fish"] },
      { char: "🍱", name: "bento box", tags: ["lunch", "japanese"] },
      { char: "🥟", name: "dumpling", tags: ["dim sum", "momo"] },
      { char: "🍤", name: "fried shrimp", tags: ["tempura"] },
      { char: "🍙", name: "rice ball", tags: ["onigiri"] },
      { char: "🍚", name: "cooked rice", tags: ["bowl", "rice"] },
      { char: "🥮", name: "moon cake", tags: ["festival"] },
      { char: "🍦", name: "soft ice cream", tags: ["dessert", "cone"] },
      { char: "🍧", name: "shaved ice", tags: ["dessert"] },
      { char: "🍨", name: "ice cream", tags: ["sweet", "dessert"] },
      { char: "🍩", name: "doughnut", tags: ["donut", "sweet"] },
      { char: "🍪", name: "cookie", tags: ["biscuit", "chocolate"] },
      { char: "🎂", name: "birthday cake", tags: ["party", "celebration"] },
      { char: "🍰", name: "shortcake", tags: ["cake", "sweet"] },
      { char: "🧁", name: "cupcake", tags: ["bakery"] },
      { char: "🥧", name: "pie", tags: ["apple pie", "bakery"] },
      { char: "🍫", name: "chocolate bar", tags: ["sweet", "candy"] },
      { char: "🍬", name: "candy", tags: ["sweet"] },
      { char: "🍭", name: "lollipop", tags: ["candy"] },
      { char: "🍿", name: "popcorn", tags: ["movie", "snack"] },
      { char: "🥞", name: "pancakes", tags: ["breakfast", "syrup"] },
      { char: "🧇", name: "waffle", tags: ["breakfast"] },
      { char: "🧀", name: "cheese wedge", tags: ["cheese"] },
      { char: "🥑", name: "avocado", tags: ["guacamole", "fruit"] },
      { char: "🍎", name: "red apple", tags: ["fruit", "healthy"] },
      { char: "🍏", name: "green apple", tags: ["fruit"] },
      { char: "🍐", name: "pear", tags: ["fruit"] },
      { char: "🍊", name: "tangerine", tags: ["orange", "citrus"] },
      { char: "🍋", name: "lemon", tags: ["sour", "citrus"] },
      { char: "🍌", name: "banana", tags: ["fruit", "potassium"] },
      { char: "🍉", name: "watermelon", tags: ["summer", "fruit"] },
      { char: "🍇", name: "grapes", tags: ["fruit", "wine"] },
      { char: "🍓", name: "strawberry", tags: ["berry", "sweet"] },
      { char: "🫐", name: "blueberries", tags: ["berry"] },
      { char: "🍒", name: "cherries", tags: ["fruit"] },
      { char: "🍑", name: "peach", tags: ["fruit", "booty"] },
      { char: "🥭", name: "mango", tags: ["tropical", "sweet"] },
      { char: "🍍", name: "pineapple", tags: ["tropical"] },
      { char: "🥥", name: "coconut", tags: ["tropical"] },
      { char: "🥝", name: "kiwi fruit", tags: ["fruit"] },
      { char: "🍅", name: "tomato", tags: ["vegetable"] },
      { char: "🍆", name: "eggplant", tags: ["aubergine"] },
      { char: "🌽", name: "ear of corn", tags: ["popcorn", "maize"] },
      { char: "🌶️", name: "hot pepper", tags: ["chili", "spicy"] },
      { char: "🧄", name: "garlic", tags: ["cooking"] },
      { char: "🧅", name: "onion", tags: ["cooking"] },
      { char: "🥔", name: "potato", tags: ["fries", "carb"] },
      { char: "🥕", name: "carrot", tags: ["rabbit", "orange"] },
      { char: "🥐", name: "croissant", tags: ["french", "bakery"] },
      { char: "🥖", name: "baguette bread", tags: ["french"] },
      { char: "🍞", name: "bread", tags: ["loaf", "toast"] },
      { char: "🍺", name: "beer mug", tags: ["drink", "alcohol"] },
      { char: "🍻", name: "clinking beer mugs", tags: ["cheers", "party"] },
      { char: "🥂", name: "clinking glasses", tags: ["toast", "celebrate"] },
      { char: "🍷", name: "wine glass", tags: ["red wine", "alcohol"] },
      { char: "🥃", name: "tumbler glass", tags: ["whiskey", "scotch"] },
      { char: "🍸", name: "cocktail glass", tags: ["martini"] },
      { char: "🍹", name: "tropical drink", tags: ["cocktail", "vacation"] },
      { char: "🍾", name: "bottle with popping cork", tags: ["champagne", "celebrate"] },
    ],
  },
  {
    id: "activities",
    name: "Activities & Sports",
    icon: Activity,
    emojis: [
      { char: "⚽", name: "soccer ball", tags: ["football", "sport"] },
      { char: "🏀", name: "basketball", tags: ["hoop", "sport"] },
      { char: "🏈", name: "american football", tags: ["nfl", "super bowl"] },
      { char: "⚾", name: "baseball", tags: ["mlb"] },
      { char: "🎾", name: "tennis", tags: ["racket"] },
      { char: "🏐", name: "volleyball", tags: ["beach"] },
      { char: "🏉", name: "rugby football", tags: ["rugby"] },
      { char: "🎱", name: "pool 8 ball", tags: ["billiards"] },
      { char: "🏓", name: "ping pong", tags: ["table tennis"] },
      { char: "🏸", name: "badminton", tags: ["shuttlecock"] },
      { char: "🥊", name: "boxing glove", tags: ["fight", "punch"] },
      { char: "🥋", name: "martial arts uniform", tags: ["karate", "judo"] },
      { char: "⛳", name: "flag in hole", tags: ["golf"] },
      { char: "🎯", name: "bullseye", tags: ["target", "dart"] },
      { char: "🛹", name: "skateboard", tags: ["skate", "board"] },
      { char: "🛼", name: "roller skate", tags: ["skating"] },
      { char: "🚴", name: "person biking", tags: ["cycling", "bike"] },
      { char: "🏋️", name: "person lifting weights", tags: ["gym", "workout"] },
      { char: "🧘", name: "person in lotus position", tags: ["yoga", "zen", "meditate"] },
      { char: "🧗", name: "person climbing", tags: ["climb", "rock"] },
      { char: "🏊", name: "person swimming", tags: ["pool", "swim"] },
      { char: "🏄", name: "person surfing", tags: ["wave", "ocean"] },
      { char: "⛷️", name: "skier", tags: ["ski", "snow"] },
      { char: "🏆", name: "trophy", tags: ["winner", "first", "champion"] },
      { char: "🥇", name: "1st place medal", tags: ["gold", "winner"] },
      { char: "🥈", name: "2nd place medal", tags: ["silver"] },
      { char: "🥉", name: "3rd place medal", tags: ["bronze"] },
      { char: "🎫", name: "ticket", tags: ["cinema", "concert"] },
      { char: "🎟️", name: "admission tickets", tags: ["raffle"] },
      { char: "🎪", name: "circus tent", tags: ["carnival"] },
      { char: "🎭", name: "performing arts", tags: ["theater", "drama"] },
      { char: "🎨", name: "artist palette", tags: ["art", "paint", "draw"] },
      { char: "🎬", name: "clapper board", tags: ["movie", "film"] },
      { char: "🎤", name: "microphone", tags: ["sing", "karaoke"] },
      { char: "🎧", name: "headphone", tags: ["music", "listen"] },
      { char: "🎼", name: "musical score", tags: ["notes"] },
      { char: "🎹", name: "musical keyboard", tags: ["piano"] },
      { char: "🥁", name: "drum", tags: ["beat"] },
      { char: "🎷", name: "saxophone", tags: ["jazz"] },
      { char: "🎺", name: "trumpet", tags: ["horn"] },
      { char: "🎸", name: "guitar", tags: ["rock", "music"] },
      { char: "🎻", name: "violin", tags: ["classical"] },
      { char: "🎮", name: "video game", tags: ["playstation", "xbox", "gaming"] },
      { char: "🕹️", name: "joystick", tags: ["arcade"] },
      { char: "🎲", name: "game die", tags: ["dice", "boardgame"] },
      { char: "♟️", name: "chess pawn", tags: ["strategy"] },
      { char: "🧩", name: "puzzle piece", tags: ["jigsaw"] },
      { char: "🎳", name: "bowling", tags: ["strike"] },
    ],
  },
  {
    id: "travel",
    name: "Travel & Places",
    icon: Car,
    emojis: [
      { char: "🚗", name: "automobile", tags: ["car", "drive"] },
      { char: "🚕", name: "taxi", tags: ["cab"] },
      { char: "🚙", name: "sport utility vehicle", tags: ["suv"] },
      { char: "🚌", name: "bus", tags: ["transit"] },
      { char: "🚎", name: "trolleybus", tags: ["commute"] },
      { char: "🏎️", name: "racing car", tags: ["fast", "f1"] },
      { char: "🚓", name: "police car", tags: ["cop"] },
      { char: "🚑", name: "ambulance", tags: ["hospital"] },
      { char: "🚒", name: "fire engine", tags: ["firetruck"] },
      { char: "🚐", name: "minibus", tags: ["van"] },
      { char: "🛻", name: "pickup truck", tags: ["truck"] },
      { char: "🚚", name: "delivery truck", tags: ["shipping"] },
      { char: "🏍️", name: "motorcycle", tags: ["bike", "moto"] },
      { char: "🛵", name: "motor scooter", tags: ["vespa"] },
      { char: "🚲", name: "bicycle", tags: ["bike", "cycle"] },
      { char: "🛴", name: "kick scooter", tags: ["scooter"] },
      { char: "✈️", name: "airplane", tags: ["flight", "travel"] },
      { char: "🛫", name: "airplane departure", tags: ["takeoff"] },
      { char: "🛬", name: "airplane arrival", tags: ["landing"] },
      { char: "🚀", name: "rocket", tags: ["space", "launch", "fast"] },
      { char: "🛸", name: "flying saucer", tags: ["ufo", "alien"] },
      { char: "🚁", name: "helicopter", tags: ["chopper"] },
      { char: "🛶", name: "canoe", tags: ["kayak", "river"] },
      { char: "⛵", name: "sailboat", tags: ["boat", "sailing"] },
      { char: "🚤", name: "speedboat", tags: ["boat"] },
      { char: "🛳️", name: "passenger ship", tags: ["cruise"] },
      { char: "⛴️", name: "ferry", tags: ["boat"] },
      { char: "🚂", name: "locomotive", tags: ["train", "steam"] },
      { char: "🚆", name: "train", tags: ["transit", "railway"] },
      { char: "🚇", name: "metro", tags: ["subway"] },
      { char: "🚊", name: "tram", tags: ["streetcar"] },
      { char: "Station", name: "station", tags: ["train"] },
      { char: "🏖️", name: "beach with umbrella", tags: ["vacation", "sand", "summer"] },
      { char: "🏝️", name: "desert island", tags: ["tropical", "paradise"] },
      { char: "🏜️", name: "desert", tags: ["sand", "dune"] },
      { char: "🌋", name: "volcano", tags: ["lava", "eruption"] },
      { char: "⛰️", name: "mountain", tags: ["climb", "hike"] },
      { char: "🏔️", name: "snow-capped mountain", tags: ["alps"] },
      { char: "⛺", name: "tent", tags: ["camping", "outdoors"] },
      { char: "🏠", name: "house", tags: ["home"] },
      { char: "🏡", name: "house with garden", tags: ["home", "cottage"] },
      { char: "🏢", name: "office building", tags: ["work"] },
      { char: "🏣", name: "Japanese post office", tags: ["mail"] },
      { char: "🏥", name: "hospital", tags: ["doctor"] },
      { char: "🏦", name: "bank", tags: ["money"] },
      { char: "🏨", name: "hotel", tags: ["stay", "travel"] },
      { char: "🏩", name: "love hotel", tags: ["motel"] },
      { char: "🏪", name: "convenience store", tags: ["shop"] },
      { char: "🏫", name: "school", tags: ["study"] },
      { char: "🏬", name: "department store", tags: ["mall"] },
      { char: "🏭", name: "factory", tags: ["industrial"] },
      { char: "🏯", name: "Japanese castle", tags: ["fort"] },
      { char: "🏰", name: "castle", tags: ["fairytale", "disney"] },
      { char: "💒", name: "wedding", tags: ["marriage", "church"] },
      { char: "🗼", name: "Tokyo tower", tags: ["japan", "tower"] },
      { char: "🗽", name: "Statue of Liberty", tags: ["new york", "usa"] },
      { char: "⛪", name: "church", tags: ["religion"] },
      { char: "🕌", name: "mosque", tags: ["islam"] },
      { char: "🛕", name: "hindu temple", tags: ["temple", "mandir"] },
      { char: "🕍", name: "synagogue", tags: ["jewish"] },
      { char: "⛩️", name: "shinto shrine", tags: ["japan", "torii"] },
      { char: "🕋", name: "kaaba", tags: ["mecca"] },
      { char: "⛲", name: "fountain", tags: ["park"] },
      { char: "🌅", name: "sunrise", tags: ["morning", "dawn", "sun"] },
      { char: "🌄", name: "sunrise over mountains", tags: ["morning"] },
      { char: "🌇", name: "sunset", tags: ["evening", "dusk"] },
      { char: "🌆", name: "cityscape at dusk", tags: ["city", "skyline"] },
      { char: "🌃", name: "night with stars", tags: ["city", "dark"] },
      { char: "🌉", name: "bridge at night", tags: ["golden gate"] },
      { char: "🌁", name: "foggy", tags: ["mist"] },
    ],
  },
  {
    id: "objects",
    name: "Objects & Tools",
    icon: Lightbulb,
    emojis: [
      { char: "💡", name: "light bulb", tags: ["idea", "smart", "bright"] },
      { char: "📱", name: "mobile phone", tags: ["iphone", "android", "cell"] },
      { char: "📲", name: "mobile phone with arrow", tags: ["incoming", "call"] },
      { char: "💻", name: "laptop", tags: ["computer", "pc", "mac"] },
      { char: "⌨️", name: "keyboard", tags: ["type"] },
      { char: "🖥️", name: "desktop computer", tags: ["screen", "monitor"] },
      { char: "🖨️", name: "printer", tags: ["paper"] },
      { char: "🖱️", name: "computer mouse", tags: ["click"] },
      { char: "📷", name: "camera", tags: ["photo", "picture", "shotzi"] },
      { char: "📸", name: "camera with flash", tags: ["photo", "selfie"] },
      { char: "📹", name: "video camera", tags: ["film", "record"] },
      { char: "🎥", name: "movie camera", tags: ["cinema"] },
      { char: "📽️", name: "film projector", tags: ["movie"] },
      { char: "🎞️", name: "film frames", tags: ["cinema", "negative"] },
      { char: "📞", name: "telephone receiver", tags: ["call", "phone"] },
      { char: "☎️", name: "telephone", tags: ["landline"] },
      { char: "📟", name: "pager", tags: ["retro"] },
      { char: "📠", name: "fax machine", tags: ["office"] },
      { char: "📺", name: "television", tags: ["tv", "show"] },
      { char: "📻", name: "radio", tags: ["broadcast", "fm"] },
      { char: "🎙️", name: "studio microphone", tags: ["podcast"] },
      { char: "🎚️", name: "level slider", tags: ["audio", "music"] },
      { char: "🎛️", name: "control knobs", tags: ["sound"] },
      { char: "🧭", name: "compass", tags: ["navigation", "direction"] },
      { char: "⏱️", name: "stopwatch", tags: ["timer", "seconds"] },
      { char: "⏲️", name: "timer clock", tags: ["kitchen"] },
      { char: "⏰", name: "alarm clock", tags: ["wake up", "morning"] },
      { char: "🕰️", name: "mantelpiece clock", tags: ["time", "antique"] },
      { char: "⌛", name: "hourglass done", tags: ["time", "sand"] },
      { char: "⏳", name: "hourglass not done", tags: ["timer", "waiting"] },
      { char: "📡", name: "satellite antenna", tags: ["signal", "wifi"] },
      { char: "🔋", name: "battery", tags: ["power", "charge"] },
      { char: "🪫", name: "low battery", tags: ["dead", "empty"] },
      { char: "🔌", name: "electric plug", tags: ["charge", "cable"] },
      { char: "🔦", name: "flashlight", tags: ["torch", "light"] },
      { char: "🕯️", name: "candle", tags: ["flame", "cozy"] },
      { char: "🪔", name: "diya lamp", tags: ["diwali", "oil lamp"] },
      { char: "🧯", name: "fire extinguisher", tags: ["emergency"] },
      { char: "💸", name: "money with wings", tags: ["cash", "spend", "loss"] },
      { char: "💵", name: "dollar banknote", tags: ["money", "usd"] },
      { char: "💴", name: "yen banknote", tags: ["money"] },
      { char: "💶", name: "euro banknote", tags: ["money"] },
      { char: "💷", name: "pound banknote", tags: ["money"] },
      { char: "🪙", name: "coin", tags: ["crypto", "gold"] },
      { char: "💰", name: "money bag", tags: ["cash", "rich"] },
      { char: "💳", name: "credit card", tags: ["visa", "mastercard"] },
      { char: "💎", name: "gem stone", tags: ["diamond", "rich", "jewel"] },
      { char: "⚖️", name: "balance scale", tags: ["justice", "law"] },
      { char: "🪜", name: "ladder", tags: ["step"] },
      { char: "🧰", name: "toolbox", tags: ["tools"] },
      { char: "🔧", name: "wrench", tags: ["fix", "tool"] },
      { char: "🔨", name: "hammer", tags: ["tool", "build"] },
      { char: "⚒️", name: "hammer and pick", tags: ["mine", "minecraft"] },
      { char: "🛠️", name: "hammer and wrench", tags: ["settings", "repair"] },
      { char: "⛏️", name: "pick", tags: ["mine"] },
      { char: "🔩", name: "nut and bolt", tags: ["screw"] },
      { char: "⚙️", name: "gear", tags: ["cog", "settings"] },
      { char: "🧱", name: "brick", tags: ["wall", "build"] },
      { char: "⛓️", name: "chains", tags: ["link", "locked"] },
      { char: "🪝", name: "hook", tags: ["catch"] },
      { char: "🧲", name: "magnet", tags: ["attract"] },
      { char: "🔫", name: "water pistol", tags: ["gun", "water gun"] },
      { char: "💣", name: "bomb", tags: ["explode", "boom"] },
      { char: "🧨", name: "firecracker", tags: ["dynamite"] },
      { char: "🪓", name: "axe", tags: ["chop", "wood"] },
      { char: "🔪", name: "kitchen knife", tags: ["cook", "chef"] },
      { char: "🗡️", name: "dagger", tags: ["sword", "weapon"] },
      { char: "⚔️", name: "crossed swords", tags: ["battle", "fight"] },
      { char: "🛡️", name: "shield", tags: ["protect", "defense", "security"] },
      { char: "🚬", name: "cigarette", tags: ["smoke"] },
      { char: "⚰️", name: "coffin", tags: ["rip", "funeral"] },
      { char: "⚱️", name: "funeral urn", tags: ["ashes"] },
      { char: "🏺", name: "amphora", tags: ["vase", "pottery"] },
      { char: "🔮", name: "crystal ball", tags: ["fortune", "magic", "future"] },
      { char: "📿", name: "prayer beads", tags: ["rosary"] },
      { char: "🧿", name: "nazar amulet", tags: ["evil eye", "protection"] },
      { char: "🪬", name: "hamsa", tags: ["hand of fatima"] },
      { char: "💈", name: "barber pole", tags: ["haircut"] },
      { char: "🧲", name: "magnet", tags: ["attract"] },
      { char: "🧪", name: "test tube", tags: ["science", "chemistry"] },
      { char: "🧫", name: "petri dish", tags: ["biology", "bacteria"] },
      { char: "🧬", name: "dna", tags: ["gene", "biology"] },
      { char: "🔬", name: "microscope", tags: ["science"] },
      { char: "🔭", name: "telescope", tags: ["astronomy", "stars"] },
      { char: "📡", name: "satellite antenna", tags: ["space"] },
      { char: "💉", name: "syringe", tags: ["vaccine", "shot"] },
      { char: "🩸", name: "drop of blood", tags: ["bleed", "donate"] },
      { char: "💊", name: "pill", tags: ["medicine", "drug"] },
      { char: "🩹", name: "adhesive bandage", tags: ["bandaid", "heal"] },
      { char: "🩺", name: "stethoscope", tags: ["doctor", "health"] },
      { char: "🚪", name: "door", tags: ["entrance", "exit"] },
      { char: "🛗", name: "elevator", tags: ["lift"] },
      { char: "🪞", name: "mirror", tags: ["reflection"] },
      { char: "🪟", name: "window", tags: ["glass"] },
      { char: "🛏️", name: "bed", tags: ["sleep", "rest"] },
      { char: "🛋️", name: "couch and lamp", tags: ["sofa", "living room"] },
      { char: "🪑", name: "chair", tags: ["seat"] },
      { char: "🚽", name: "toilet", tags: ["restroom", "wc"] },
      { char: "🪠", name: "plunger", tags: ["plumbing"] },
      { char: "🚿", name: "shower", tags: ["bath"] },
      { char: "🛁", name: "bathtub", tags: ["bath", "relax"] },
      { char: "🪤", name: "mouse trap", tags: ["trap"] },
      { char: "🪒", name: "razor", tags: ["shave"] },
      { char: "🧴", name: "lotion bottle", tags: ["skincare", "cream"] },
      { char: "🧷", name: "safety pin", tags: ["pin"] },
      { char: "🧹", name: "broom", tags: ["clean", "sweep"] },
      { char: "🧺", name: "basket", tags: ["laundry", "picnic"] },
      { char: "🧻", name: "roll of paper", tags: ["toilet paper"] },
      { char: "🪣", name: "bucket", tags: ["pail"] },
      { char: "🧼", name: "soap", tags: ["clean", "wash"] },
      { char: "🪥", name: "toothbrush", tags: ["dental"] },
      { char: "🧽", name: "sponge", tags: ["wash"] },
      { char: "🧯", name: "fire extinguisher", tags: ["safety"] },
      { char: "🛒", name: "shopping cart", tags: ["buy", "store"] },
      { char: "🚬", name: "cigarette", tags: ["smoke"] },
      { char: "⚰️", name: "coffin", tags: ["grave"] },
      { char: "🪦", name: "headstone", tags: ["rip", "tombstone"] },
      { char: "⚱️", name: "funeral urn", tags: ["cremation"] },
      { char: "🧿", name: "nazar amulet", tags: ["talisman"] },
      { char: "🪬", name: "hamsa", tags: ["luck"] },
      { char: "🗿", name: "moai", tags: ["easter island", "stone face"] },
      { char: "🪧", name: "placard", tags: ["sign", "protest"] },
      { char: "🪪", name: "identification card", tags: ["id", "license"] },
    ],
  },
];

const STORAGE_KEY = "shotzi_recent_emojis";

export default function EmojiPicker({
  onSelectEmoji,
  onClose,
  isOpen = true,
  align = "left", // "left" | "right" | "center"
  className = "",
}) {
  const [activeTab, setActiveTab] = useState("smileys");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentEmojis, setRecentEmojis] = useState([]);
  const pickerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Load recent emojis on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecentEmojis(parsed);
          setActiveTab("recent");
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Handle click outside to close
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Handle selecting an emoji
  const handleEmojiClick = (emojiChar) => {
    onSelectEmoji?.(emojiChar);

    // Save to recents
    try {
      const updated = [
        emojiChar,
        ...recentEmojis.filter((e) => e !== emojiChar),
      ].slice(0, 24);
      setRecentEmojis(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  // Filter emojis based on search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();

    const matches = [];
    const seen = new Set();

    for (const cat of WHATSAPP_EMOJI_CATEGORIES) {
      if (cat.id === "recent") continue;
      for (const item of cat.emojis) {
        if (seen.has(item.char)) continue;
        if (
          item.name.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q))
        ) {
          matches.push(item.char);
          seen.add(item.char);
        }
      }
    }
    return matches;
  }, [searchQuery]);

  if (!isOpen) return null;

  const currentCategory = WHATSAPP_EMOJI_CATEGORIES.find((c) => c.id === activeTab);
  const displayEmojis =
    activeTab === "recent"
      ? recentEmojis
      : currentCategory?.emojis.map((e) => e.char) || [];

  return (
    <div
      ref={pickerRef}
      className={`absolute bottom-full mb-3 z-50 w-[310px] sm:w-[350px] max-w-[calc(100vw-24px)] h-[360px] bg-white border-[2.5px] border-black rounded-2xl shadow-[5px_5px_0px_#18181B] flex flex-col overflow-hidden animate-scale-in select-none touch-manipulation ${
        align === "right"
          ? "right-0"
          : align === "center"
          ? "left-1/2 -translate-x-1/2"
          : "left-0"
      } ${className}`}
    >
      {/* Top Search & Close Bar */}
      <div className="p-2.5 bg-[#FFFDEB] border-b-2 border-black/10 flex items-center gap-2">
        <div className="flex-1 relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all emojis..."
            className="w-full pl-8 pr-7 py-1.5 rounded-full border border-black/25 bg-white text-xs font-semibold text-black placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-1 focus:ring-[#FFD21E] transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-zinc-400 hover:text-black p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full border border-black/20 flex items-center justify-center text-zinc-400 hover:text-black hover:bg-zinc-100 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs (Like WhatsApp) */}
      {!searchQuery && (
        <div className="px-2 py-1.5 bg-zinc-50 border-b border-black/10 flex items-center justify-between overflow-x-auto gap-1 shrink-0 scrollbar-none">
          {WHATSAPP_EMOJI_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;

            // Hide recent tab if none saved
            if (cat.id === "recent" && recentEmojis.length === 0) return null;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveTab(cat.id)}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#FFD21E] text-black border border-black shadow-2xs scale-105"
                    : "text-zinc-400 hover:text-black hover:bg-zinc-200/60"
                }`}
                title={cat.name}
              >
                <Icon className="w-4 h-4 stroke-[2.2]" />
              </button>
            );
          })}
        </div>
      )}

      {/* Main Emojis Scroll Area */}
      <div className="flex-1 p-2.5 overflow-y-auto overscroll-contain">
        {searchQuery ? (
          <div>
            <div className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-2 px-1">
              Search Results ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 font-semibold">
                No matching emojis found for "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                {searchResults.map((emoji, idx) => (
                  <button
                    key={`search-${idx}`}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="w-9 h-9 flex items-center justify-center text-xl sm:text-2xl hover:scale-125 active:scale-95 transition-transform rounded-lg hover:bg-zinc-100 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="text-[10.5px] font-black text-black uppercase tracking-wider mb-2 px-1 flex items-center justify-between">
              <span>{currentCategory?.name || "Emojis"}</span>
              {activeTab === "recent" && recentEmojis.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setRecentEmojis([]);
                    localStorage.removeItem(STORAGE_KEY);
                    setActiveTab("smileys");
                  }}
                  className="text-[10px] text-zinc-400 hover:text-red-500 font-bold lowercase hover:underline"
                >
                  clear
                </button>
              )}
            </div>

            {displayEmojis.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 font-semibold">
                No recent emojis yet. Click any emoji below to use it!
              </div>
            ) : (
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                {displayEmojis.map((emoji, idx) => (
                  <button
                    key={`emoji-${activeTab}-${idx}`}
                    type="button"
                    onClick={() => handleEmojiClick(emoji)}
                    className="w-9 h-9 flex items-center justify-center text-xl sm:text-2xl hover:scale-125 active:scale-95 transition-transform rounded-lg hover:bg-zinc-100 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Quick Reaction Row (Like WhatsApp) */}
      <div className="px-3 py-1.5 bg-zinc-50 border-t border-black/10 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
          Quick:
        </span>
        <div className="flex items-center gap-2">
          {["❤️", "😂", "🔥", "👍", "🙏", "✨", "😍", "🎉"].map((emoji) => (
            <button
              key={`quick-${emoji}`}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="text-base sm:text-lg hover:scale-125 transition-transform cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
